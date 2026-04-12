#!/usr/bin/env node
// scripts/collect-usage.mjs
// Scans ~/.claude/projects/**/*.jsonl, groups assistant messages into 5-hour
// rate-limit windows, and writes ~/.claude/usage-windows-cache.json.
// Run directly: node scripts/collect-usage.mjs

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const HOME = homedir();
const PROJECTS_DIR = join(HOME, '.claude', 'projects');
const OUTPUT_FILE = join(HOME, '.claude', 'usage-windows-cache.json');

// ---------------------------------------------------------------------------
// Pure functions (logic mirrors src/lib/utils.ts groupIntoWindows)
// ---------------------------------------------------------------------------

function buildUsageWindow(messages, windowStart) {
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  let cumulative = 0;

  const timeline = messages.map((msg) => {
    const tokens =
      msg.inputTokens + msg.outputTokens + msg.cacheReadTokens + msg.cacheCreationTokens;
    inputTokens += msg.inputTokens;
    outputTokens += msg.outputTokens;
    cacheReadTokens += msg.cacheReadTokens;
    cacheCreationTokens += msg.cacheCreationTokens;
    cumulative += tokens;
    return {
      timestamp: msg.timestamp,
      minutesFromStart: Math.round(
        (new Date(msg.timestamp).getTime() - windowStart.getTime()) / 60_000
      ),
      tokens,
      cumulativeTokens: cumulative,
    };
  });

  return {
    id: windowStart.toISOString(),
    startTime: windowStart.toISOString(),
    endTime: new Date(windowStart.getTime() + FIVE_HOURS_MS).toISOString(),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
    requestCount: messages.length,
    timeline,
  };
}

function groupIntoWindows(messages) {
  if (messages.length === 0) return [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const windows = [];
  let windowStart = new Date(sorted[0].timestamp);
  let bucket = [];

  for (const msg of sorted) {
    const t = new Date(msg.timestamp).getTime();
    if (t - windowStart.getTime() >= FIVE_HOURS_MS) {
      windows.push(buildUsageWindow(bucket, windowStart));
      windowStart = new Date(msg.timestamp);
      bucket = [];
    }
    bucket.push(msg);
  }

  if (bucket.length > 0) {
    windows.push(buildUsageWindow(bucket, windowStart));
  }

  return windows;
}

function truncateToHour(isoString) {
  const d = new Date(isoString);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function getWeekStart(isoString) {
  // Returns YYYY-MM-DD of the Monday of the ISO week containing the given date (UTC).
  const d = new Date(isoString);
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setUTCDate(d.getUTCDate() - daysToMonday);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

function collectMessages() {
  if (!existsSync(PROJECTS_DIR)) return [];

  const messages = [];

  let projectDirs;
  try {
    projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }

  for (const dir of projectDirs) {
    const projectPath = join(PROJECTS_DIR, dir);
    let files;
    try {
      files = readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(projectPath, file);
      let text;
      try {
        text = readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        let record;
        try {
          record = JSON.parse(line);
        } catch {
          continue;
        }

        if (record.type !== 'assistant' || !record.message?.usage || !record.timestamp) {
          continue;
        }

        const u = record.message.usage;
        messages.push({
          timestamp: record.timestamp,
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
          cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
        });
      }
    }
  }

  return messages;
}

function computeHourlyAggregates(messages) {
  /** @type {Record<string, {hour: string, tokens: number, requests: number}>} */
  const map = {};
  for (const msg of messages) {
    const hour = truncateToHour(msg.timestamp);
    if (!map[hour]) map[hour] = { hour, tokens: 0, requests: 0 };
    map[hour].tokens +=
      msg.inputTokens + msg.outputTokens + msg.cacheReadTokens + msg.cacheCreationTokens;
    map[hour].requests++;
  }
  return Object.values(map).sort((a, b) => a.hour.localeCompare(b.hour));
}

function computeWeeklyAggregates(messages) {
  /** @type {Record<string, {weekStart: string, tokens: number, requests: number}>} */
  const map = {};
  for (const msg of messages) {
    const weekStart = getWeekStart(msg.timestamp);
    if (!map[weekStart]) map[weekStart] = { weekStart, tokens: 0, requests: 0 };
    map[weekStart].tokens +=
      msg.inputTokens + msg.outputTokens + msg.cacheReadTokens + msg.cacheCreationTokens;
    map[weekStart].requests++;
  }
  return Object.values(map).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const messages = collectMessages();
const windows = groupIntoWindows(messages);
const hourlyAggregates = computeHourlyAggregates(messages);
const weeklyAggregates = computeWeeklyAggregates(messages);

const cache = {
  generatedAt: new Date().toISOString(),
  windows,
  hourlyAggregates,
  weeklyAggregates,
};

try {
  writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
} catch (err) {
  console.error(`[collect-usage] Failed to write cache: ${err.message}`);
  process.exit(1);
}
console.log(
  `[collect-usage] ${windows.length} windows, ${messages.length} requests → ${OUTPUT_FILE}`
);
