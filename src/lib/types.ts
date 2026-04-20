export interface ProjectStats {
  id: string;
  displayName: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  firstDate: string;
  lastDate: string;
  activeDays: number;
}

export interface PromptEntry {
  id: string;
  projectId: string;
  projectName: string;
  timestamp: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface RawUsageMessage {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface WindowTimelinePoint {
  timestamp: string;         // ISO 8601
  minutesFromStart: number;  // rounded to nearest minute
  tokens: number;            // tokens in this single request
  cumulativeTokens: number;  // running total within the window
}

export interface UsageWindow {
  id: string;                  // equals startTime (used as React key)
  startTime: string;           // ISO 8601 — first request in this window
  endTime: string;             // startTime + 5 hours
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;         // sum of all four above
  requestCount: number;
  timeline: WindowTimelinePoint[];
}

export interface HourlyAggregate {
  hour: string;      // ISO 8601 truncated to hour: "2026-04-12T10:00:00.000Z"
  tokens: number;
  requests: number;
}

export interface WeeklyAggregate {
  weekStart: string; // YYYY-MM-DD of Monday for that week (UTC)
  tokens: number;
  requests: number;
}

// Pagination
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// DB row types (match SQLite schema)
export interface MessageRow {
  id: string;
  session_id: string;
  project_id: string;
  project_name: string;
  role: 'user' | 'assistant';
  timestamp: string;
  content: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cost_usd: number;
  source_file: string;
  source_line: number;
}

export interface UsageWindowRow {
  id: number;
  start_time: string;
  end_time: string;
  window_close_time: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
  active_duration_sec: number;
  active_periods: number;
  peak_minute_tokens: number;
}

export interface WindowTimelineRow {
  id: number;
  window_id: number;
  timestamp: string;
  minutes_from_start: number;
  tokens: number;
  cumulative_tokens: number;
}
