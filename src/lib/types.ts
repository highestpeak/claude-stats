export interface ProjectStats {
  id: string;
  displayName: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
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

export interface UsageCache {
  generatedAt: string;                // ISO 8601 when the script last ran
  windows: UsageWindow[];             // all historical 5h windows, oldest first
  hourlyAggregates: HourlyAggregate[]; // one entry per clock-hour that had activity
  weeklyAggregates: WeeklyAggregate[]; // one entry per calendar week that had activity
}
