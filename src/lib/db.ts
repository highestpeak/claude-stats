import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const DB_PATH = path.join(os.homedir(), '.claude', 'claude-stats.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id                    TEXT PRIMARY KEY,
      session_id            TEXT NOT NULL,
      project_id            TEXT NOT NULL,
      project_name          TEXT NOT NULL,
      role                  TEXT NOT NULL,
      timestamp             TEXT NOT NULL,
      content               TEXT,
      model                 TEXT,
      input_tokens          INTEGER DEFAULT 0,
      output_tokens         INTEGER DEFAULT 0,
      cache_read_tokens     INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cost_usd              REAL DEFAULT 0,
      source_file           TEXT NOT NULL,
      source_line           INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);

    CREATE TABLE IF NOT EXISTS usage_windows (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time            TEXT NOT NULL,
      end_time              TEXT NOT NULL,
      window_close_time     TEXT NOT NULL,
      request_count         INTEGER NOT NULL,
      input_tokens          INTEGER DEFAULT 0,
      output_tokens         INTEGER DEFAULT 0,
      cache_read_tokens     INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      total_tokens          INTEGER DEFAULT 0,
      active_duration_sec   INTEGER DEFAULT 0,
      active_periods        INTEGER DEFAULT 0,
      peak_minute_tokens    INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_windows_start ON usage_windows(start_time);

    CREATE TABLE IF NOT EXISTS window_timeline (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      window_id          INTEGER NOT NULL REFERENCES usage_windows(id),
      timestamp          TEXT NOT NULL,
      minutes_from_start REAL NOT NULL,
      tokens             INTEGER NOT NULL,
      cumulative_tokens  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_timeline_window ON window_timeline(window_id);

    CREATE TABLE IF NOT EXISTS processed_files (
      file_path     TEXT PRIMARY KEY,
      mtime_ms      INTEGER NOT NULL,
      line_count    INTEGER NOT NULL,
      processed_at  TEXT NOT NULL
    );
  `);
}

/** Get the latest processed_at timestamp, or null if no data. */
export function getLastUpdated(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT MAX(processed_at) as last FROM processed_files').get() as { last: string | null } | undefined;
  return row?.last ?? null;
}

/** Helper: paginate a query. Returns { data, pagination }. */
export function paginate<T>(
  db: Database.Database,
  dataQuery: string,
  countQuery: string,
  params: Record<string, unknown>,
  page: number,
  pageSize: number
): { data: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } {
  const total = (db.prepare(countQuery).get(params) as { count: number }).count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const data = db.prepare(dataQuery).all({ ...params, limit: pageSize, offset }) as T[];
  return {
    data,
    pagination: { page: safePage, pageSize, total, totalPages },
  };
}
