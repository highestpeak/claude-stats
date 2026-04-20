#!/usr/bin/env node
// scripts/collect-to-db.mjs
// Scans ~/.claude/projects/**/*.jsonl, parses messages, and writes them into
// SQLite at ~/.claude/claude-stats.db.  Also rebuilds usage_windows and
// window_timeline from the stored assistant messages.
// Run directly: node scripts/collect-to-db.mjs

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import Database from 'better-sqlite3';

/** Recursively find all .jsonl files under a directory. */
function findJsonlFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findJsonlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const HOME = homedir();
const PROJECTS_DIR = join(HOME, '.claude', 'projects');
const DB_PATH = join(HOME, '.claude', 'claude-stats.db');

const TOKEN_PRICES = {
  'claude-opus-4-6':   { input: 15, output: 75, cacheRead: 1.5, cacheCreation: 18.75 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3, cacheCreation: 3.75 },
  'claude-haiku-4-5':  { input: 0.8, output: 4, cacheRead: 0.08, cacheCreation: 1 },
};

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------

function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

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

  return db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(filePath, lineNumber) {
  return createHash('sha256').update(`${filePath}:${lineNumber}`).digest('hex').slice(0, 32);
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c?.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n');
  }
  return '';
}

function isToolUseResult(content) {
  if (!Array.isArray(content)) return false;
  return content.some((c) => c?.type === 'tool_result');
}

function matchPrices(model) {
  if (!model) return null;
  for (const prefix of Object.keys(TOKEN_PRICES)) {
    if (model.startsWith(prefix)) return TOKEN_PRICES[prefix];
  }
  return null;
}

function computeCost(prices, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens) {
  if (!prices) return 0;
  return (
    (inputTokens / 1_000_000) * prices.input +
    (outputTokens / 1_000_000) * prices.output +
    (cacheReadTokens / 1_000_000) * prices.cacheRead +
    (cacheCreationTokens / 1_000_000) * prices.cacheCreation
  );
}

function decodeProjectName(dirName) {
  // Strip encoded home dir prefix, keep remaining string as-is (dashes intact).
  // We can't distinguish path-separator dashes from literal dashes in names,
  // so we only strip the known home prefix for a shorter display name.
  // e.g. "-Users-zhangjike-code-my-project" → "code-my-project"
  const home = homedir();
  const encodedHome = home.replace(/\//g, '-'); // '/Users/zhangjike' → '-Users-zhangjike'
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, '');
    return rest || dirName;
  }
  return dirName.replace(/^-/, '');
}

// ---------------------------------------------------------------------------
// Scanning & parsing
// ---------------------------------------------------------------------------

function collectAndInsert(db) {
  if (!existsSync(PROJECTS_DIR)) {
    console.log('[collect-to-db] No projects directory found, nothing to do.');
    return { messagesInserted: 0, filesProcessed: 0 };
  }

  let projectDirs;
  try {
    projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return { messagesInserted: 0, filesProcessed: 0 };
  }

  const getProcessed = db.prepare('SELECT mtime_ms, line_count FROM processed_files WHERE file_path = ?');
  const upsertProcessed = db.prepare(`
    INSERT INTO processed_files (file_path, mtime_ms, line_count, processed_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(file_path) DO UPDATE SET mtime_ms = excluded.mtime_ms, line_count = excluded.line_count, processed_at = excluded.processed_at
  `);
  const insertMsg = db.prepare(`
    INSERT OR IGNORE INTO messages
      (id, session_id, project_id, project_name, role, timestamp, content, model,
       input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
       cost_usd, source_file, source_line)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalInserted = 0;
  let totalFiles = 0;
  const now = new Date().toISOString();

  for (const dir of projectDirs) {
    const projectPath = join(PROJECTS_DIR, dir);
    const projectId = dir;
    const projectName = decodeProjectName(dir);

    const jsonlFiles = findJsonlFiles(projectPath);

    for (const filePath of jsonlFiles) {
      // Session ID: use the filename without extension
      // For subagents: "agent-xxx.jsonl" → "agent-xxx"
      const sessionId = basename(filePath, '.jsonl');

      let stat;
      try {
        stat = statSync(filePath);
      } catch {
        continue;
      }

      const mtimeMs = Math.floor(stat.mtimeMs);
      const prev = getProcessed.get(filePath);

      // Skip if mtime unchanged
      if (prev && prev.mtime_ms === mtimeMs) {
        continue;
      }

      const skipLines = prev ? prev.line_count : 0;

      let text;
      try {
        text = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      const lines = text.split('\n');
      let lineCount = 0;
      let inserted = 0;

      const txn = db.transaction(() => {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          lineCount++;

          // Skip already-processed lines
          if (lineCount <= skipLines) continue;

          let record;
          try {
            record = JSON.parse(line);
          } catch {
            continue;
          }

          if (!record.timestamp) continue;

          if (record.type === 'user') {
            const msg = record.message;
            if (!msg) continue;
            if (msg.isMeta) continue;
            if (isToolUseResult(msg.content)) continue;

            const content = extractText(msg.content);
            if (!content) continue;

            const id = makeId(filePath, lineCount);
            insertMsg.run(
              id, sessionId, projectId, projectName, 'user',
              record.timestamp, content, null,
              0, 0, 0, 0, 0,
              filePath, lineCount
            );
            inserted++;
          } else if (record.type === 'assistant') {
            const msg = record.message;
            if (!msg?.usage) continue;

            const u = msg.usage;
            const inputTokens = u.input_tokens ?? 0;
            const outputTokens = u.output_tokens ?? 0;
            const cacheReadTokens = u.cache_read_input_tokens ?? 0;
            const cacheCreationTokens = u.cache_creation_input_tokens ?? 0;
            const model = msg.model ?? null;
            const prices = matchPrices(model);
            const costUsd = computeCost(prices, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens);

            const id = makeId(filePath, lineCount);
            insertMsg.run(
              id, sessionId, projectId, projectName, 'assistant',
              record.timestamp, null, model,
              inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens,
              costUsd, filePath, lineCount
            );
            inserted++;
          }
        }

        upsertProcessed.run(filePath, mtimeMs, lineCount, now);
      });

      txn();
      totalInserted += inserted;
      totalFiles++;
    }
  }

  return { messagesInserted: totalInserted, filesProcessed: totalFiles };
}

// ---------------------------------------------------------------------------
// Rebuild usage_windows + window_timeline
// ---------------------------------------------------------------------------

function rebuildWindows(db) {
  const assistantRows = db.prepare(`
    SELECT timestamp, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens
    FROM messages
    WHERE role = 'assistant'
    ORDER BY timestamp ASC
  `).all();

  if (assistantRows.length === 0) {
    db.exec('DELETE FROM window_timeline');
    db.exec('DELETE FROM usage_windows');
    return 0;
  }

  // Group into 5h windows (gap >= 5h between consecutive messages = new window)
  const windows = [];
  let bucket = [assistantRows[0]];
  let windowStartMs = new Date(assistantRows[0].timestamp).getTime();

  for (let i = 1; i < assistantRows.length; i++) {
    const row = assistantRows[i];
    const tMs = new Date(row.timestamp).getTime();
    if (tMs - windowStartMs >= FIVE_HOURS_MS) {
      windows.push({ startMs: windowStartMs, rows: bucket });
      windowStartMs = tMs;
      bucket = [];
    }
    bucket.push(row);
  }
  if (bucket.length > 0) {
    windows.push({ startMs: windowStartMs, rows: bucket });
  }

  // Rebuild in a transaction
  const txn = db.transaction(() => {
    db.exec('DELETE FROM window_timeline');
    db.exec('DELETE FROM usage_windows');

    const insertWindow = db.prepare(`
      INSERT INTO usage_windows
        (start_time, end_time, window_close_time, request_count,
         input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
         total_tokens, active_duration_sec, active_periods, peak_minute_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTimeline = db.prepare(`
      INSERT INTO window_timeline (window_id, timestamp, minutes_from_start, tokens, cumulative_tokens)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const win of windows) {
      const rows = win.rows;
      const startMs = win.startMs;
      const startTime = new Date(startMs).toISOString();
      const lastTs = new Date(rows[rows.length - 1].timestamp).getTime();
      const endTime = new Date(lastTs).toISOString();
      const windowCloseTime = new Date(startMs + FIVE_HOURS_MS).toISOString();

      let inputTok = 0, outputTok = 0, cacheReadTok = 0, cacheCreationTok = 0;

      // Active duration / active periods: >5min gap = new period
      let activeDurationSec = 0;
      let activePeriods = 1;
      let prevMs = startMs;

      // Peak minute tokens: bucket by minute offset
      const minuteBuckets = {};

      for (const row of rows) {
        inputTok += row.input_tokens;
        outputTok += row.output_tokens;
        cacheReadTok += row.cache_read_tokens;
        cacheCreationTok += row.cache_creation_tokens;

        const tMs = new Date(row.timestamp).getTime();
        const gapMs = tMs - prevMs;

        if (gapMs > FIVE_MINUTES_MS) {
          activePeriods++;
        } else {
          activeDurationSec += Math.round(gapMs / 1000);
        }
        prevMs = tMs;

        const minuteOffset = Math.floor((tMs - startMs) / 60_000);
        const tokens = row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_creation_tokens;
        minuteBuckets[minuteOffset] = (minuteBuckets[minuteOffset] ?? 0) + tokens;
      }

      const totalTok = inputTok + outputTok + cacheReadTok + cacheCreationTok;
      const peakMinuteTokens = Math.max(0, ...Object.values(minuteBuckets));

      const result = insertWindow.run(
        startTime, endTime, windowCloseTime, rows.length,
        inputTok, outputTok, cacheReadTok, cacheCreationTok,
        totalTok, activeDurationSec, activePeriods, peakMinuteTokens
      );

      const windowId = result.lastInsertRowid;

      // Timeline points
      let cumulative = 0;
      for (const row of rows) {
        const tMs = new Date(row.timestamp).getTime();
        const minutesFromStart = (tMs - startMs) / 60_000;
        const tokens = row.input_tokens + row.output_tokens + row.cache_read_tokens + row.cache_creation_tokens;
        cumulative += tokens;
        insertTimeline.run(windowId, row.timestamp, minutesFromStart, tokens, cumulative);
      }
    }
  });

  txn();
  return windows.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const db = openDb();

try {
  const { messagesInserted, filesProcessed } = collectAndInsert(db);
  const windowCount = rebuildWindows(db);
  console.log(
    `[collect-to-db] ${filesProcessed} files processed, ${messagesInserted} messages inserted, ${windowCount} windows built → ${DB_PATH}`
  );
} catch (err) {
  console.error(`[collect-to-db] Error: ${err.message}`);
  process.exit(1);
} finally {
  db.close();
}
