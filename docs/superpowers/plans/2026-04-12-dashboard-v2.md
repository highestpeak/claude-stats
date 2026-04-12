# Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand claude-stats from a single-page overview into a 4-tab dashboard with Token details, Project breakdown, and Prompt history.

**Architecture:** Add top-tab Nav in layout, new Next.js App Router pages at `/tokens`, `/projects`, `/prompts`. Two new API routes read `~/.claude/projects/` directly (the canonical data source — one `.jsonl` file per conversation per project directory). Shared types and utility functions go in `src/lib/`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Recharts, Tailwind CSS (existing), Vitest (new), html2canvas (new)

---

## Data Notes

Project JSONL messages (`~/.claude/projects/<encoded-path>/<uuid>.jsonl`):
- **Human prompts:** `type === "user"` AND `!toolUseResult` AND `!isMeta`
- **Token usage:** on `type === "assistant"` messages, field `message.usage` has `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- **Timestamp:** top-level `timestamp` field (ISO 8601 string)
- **Project dir encoding:** `/Users/alice/code/my-proj` → `-Users-alice-code-my-proj`

---

## File Map

**New files:**
- `src/lib/types.ts` — shared interfaces (ProjectStats, PromptEntry)
- `src/lib/utils.ts` — calcStreaks, decodeProjectName, topWords, calcCacheSavings, formatNumber, formatCurrency, TOKEN_PRICES
- `src/lib/utils.test.ts` — Vitest tests for utils
- `vitest.config.ts` — Vitest config with `@` alias
- `src/components/Nav.tsx` — top tab bar (4 tabs)
- `src/components/WeeklyHeatmap.tsx` — 7×24 day×hour activity grid
- `src/app/tokens/page.tsx` — Tokens page
- `src/components/TokenBreakdown.tsx` — stacked horizontal bar per model
- `src/components/CacheEfficiency.tsx` — cache hit rate + savings
- `src/components/ModelCostChart.tsx` — cost donut by model
- `src/app/api/projects/route.ts` — reads ~/.claude/projects/
- `src/app/projects/page.tsx` — Projects page
- `src/components/ProjectChart.tsx` — horizontal bar top 10
- `src/components/ProjectTable.tsx` — sortable table with expand
- `src/app/api/prompts/route.ts` — reads user messages from project files
- `src/app/prompts/page.tsx` — Prompts page
- `src/components/PromptList.tsx` — scrollable prompt list
- `src/components/PromptAnalysis.tsx` — word freq + length distribution
- `src/components/ExportButton.tsx` — html2canvas PNG export

**Modified files:**
- `src/app/layout.tsx` — add `<Nav />`
- `src/components/OverviewCards.tsx` — add Total Cost + Cache Savings cards
- `src/components/DeveloperMetrics.tsx` — add Current Streak + Longest Streak
- `src/app/page.tsx` — add `<WeeklyHeatmap />`, pass hourCounts to it

---

## Task 1: Vitest setup + shared lib

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/types.ts`
- Create: `src/lib/utils.ts`
- Create: `src/lib/utils.test.ts`

- [ ] **Step 1: Install Vitest**

```bash
cd /Users/zhangjike/code/my-code/claude-stats
npm install -D vitest
```

- [ ] **Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
});
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Create src/lib/types.ts**

```typescript
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
```

- [ ] **Step 5: Write failing tests first**

Create `src/lib/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calcStreaks, decodeProjectName, topWords, calcCacheSavings } from './utils';

describe('calcStreaks', () => {
  it('returns zeros for empty input', () => {
    expect(calcStreaks([])).toEqual({ current: 0, longest: 0 });
  });
  it('counts 3 consecutive days', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(longest).toBe(3);
  });
  it('resets on a one-day gap', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-03']);
    expect(longest).toBe(1);
  });
  it('deduplicates same-day entries', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-01', '2025-01-02']);
    expect(longest).toBe(2);
  });
  it('current streak is 0 when last date is older than yesterday', () => {
    const { current } = calcStreaks(['2020-01-01', '2020-01-02']);
    expect(current).toBe(0);
  });
});

describe('decodeProjectName', () => {
  it('strips home dir prefix', () => {
    expect(decodeProjectName('-Users-alice-code-myproj', '/Users/alice')).toBe('code-myproj');
  });
  it('strips leading dash when no home match', () => {
    expect(decodeProjectName('-foo-bar', '/Users/alice')).toBe('foo-bar');
  });
  it('returns empty-safe fallback', () => {
    expect(decodeProjectName('-Users-alice', '/Users/alice')).toBe('-Users-alice');
  });
});

describe('topWords', () => {
  it('returns top N words by frequency', () => {
    const result = topWords(['hello world hello', 'hello'], 2);
    expect(result[0]).toEqual({ word: 'hello', count: 3 });
    expect(result[1]).toEqual({ word: 'world', count: 1 });
  });
  it('filters English stop words', () => {
    const result = topWords(['the quick brown fox'], 10);
    const words = result.map((r) => r.word);
    expect(words).not.toContain('the');
  });
  it('handles empty input', () => {
    expect(topWords([], 5)).toEqual([]);
  });
});

describe('calcCacheSavings', () => {
  it('computes savings for claude-sonnet-4-6', () => {
    // $3/M input, $0.30/M cache read → savings = $2.70 per 1M tokens
    const savings = calcCacheSavings({
      'claude-sonnet-4-6': { cacheReadInputTokens: 1_000_000 },
    });
    expect(savings).toBeCloseTo(2.7);
  });
  it('returns 0 for unknown model', () => {
    expect(calcCacheSavings({ 'unknown-model': { cacheReadInputTokens: 1_000_000 } })).toBe(0);
  });
});
```

- [ ] **Step 6: Run tests — expect all to FAIL**

```bash
npm test
```

Expected: multiple failures like "calcStreaks is not a function"

- [ ] **Step 7: Create src/lib/utils.ts**

```typescript
// Token prices in USD per 1M tokens
export const TOKEN_PRICES: Record<string, {
  input: number; output: number; cacheRead: number; cacheCreation: number;
}> = {
  'claude-opus-4-6':         { input: 15,   output: 75,  cacheRead: 1.5,  cacheCreation: 18.75 },
  'claude-sonnet-4-6':       { input: 3,    output: 15,  cacheRead: 0.3,  cacheCreation: 3.75  },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4,   cacheRead: 0.08, cacheCreation: 1.0   },
};

/** Decode project directory name to a human-readable path string.
 *  e.g. '-Users-alice-code-myproj' + '/Users/alice' → 'code-myproj'
 */
export function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, '-'); // '/Users/alice' → '-Users-alice'
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, '');
    return rest || dirName; // fallback to original if nothing remains
  }
  return dirName.replace(/^-/, '');
}

/** Calculate current and longest active-day streaks from an array of date strings (YYYY-MM-DD). */
export function calcStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000;
    if (diff === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current streak: only counts if last active date is today or yesterday
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lastDate = sorted[sorted.length - 1];
  let current = 0;
  if (lastDate === today || lastDate === yesterday) {
    // Count backwards from the end
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      const diff =
        (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000;
      if (diff === 1) current++;
      else break;
    }
  }

  return { current, longest };
}

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can','not',
  'in','on','at','to','for','of','and','or','but','if','with','this','that',
  'it','its','i','you','we','they','me','my','your','our','their','what','how',
  'when','where','why','which','who','so','by','from','into','just','also',
  '的','了','是','在','我','你','他','她','们','个','有','不','好','就','也',
  '一','这','那','和','与','或','但','因','为','把','么','呢','啊','吧',
]);

/** Return top N words by frequency across all texts, filtering stop words. */
export function topWords(texts: string[], n: number): Array<{ word: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    const tokens = text.toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z]{3,}/g) ?? [];
    for (const w of tokens) {
      if (!STOP_WORDS.has(w)) freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Estimate USD saved by cache reads vs paying full input price. */
export function calcCacheSavings(
  modelUsage: Record<string, { cacheReadInputTokens: number }>
): number {
  let total = 0;
  for (const [model, usage] of Object.entries(modelUsage)) {
    const prices = TOKEN_PRICES[model];
    if (!prices) continue;
    total += (usage.cacheReadInputTokens / 1_000_000) * (prices.input - prices.cacheRead);
  }
  return total;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function formatCurrency(usd: number): string {
  return '$' + usd.toFixed(2);
}
```

- [ ] **Step 8: Run tests — expect all to PASS**

```bash
npm test
```

Expected: `Tests 12 passed (12)`

- [ ] **Step 9: Commit**

```bash
git init && git add vitest.config.ts src/lib/types.ts src/lib/utils.ts src/lib/utils.test.ts package.json package-lock.json
git commit -m "feat: add shared lib (utils, types) with Vitest"
```

---

## Task 2: Nav + layout

**Files:**
- Create: `src/components/Nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create src/components/Nav.tsx**

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",         label: "Overview"  },
  { href: "/tokens",   label: "Tokens"    },
  { href: "/projects", label: "Projects"  },
  { href: "/prompts",  label: "Prompts"   },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-card sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-12">
        <span className="text-textPrimary font-semibold text-sm mr-4">Claude Stats</span>
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              pathname === tab.href
                ? "bg-bg text-textPrimary font-medium"
                : "text-textSecondary hover:text-textPrimary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Update src/app/layout.tsx**

Replace the entire file content:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Claude Code Stats",
  description: "Claude Code usage statistics dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-textPrimary antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify — start dev server and check nav appears**

```bash
npm run dev
```

Open http://localhost:3847. The sticky top nav should show "Claude Stats | Overview Tokens Projects Prompts". Overview tab should be highlighted. Other tabs 404 for now — that's fine.

- [ ] **Step 4: Commit**

```bash
git add src/components/Nav.tsx src/app/layout.tsx
git commit -m "feat: add top tab navigation"
```

---

## Task 3: Enhance Overview page

**Files:**
- Modify: `src/components/OverviewCards.tsx`
- Modify: `src/components/DeveloperMetrics.tsx`
- Create: `src/components/WeeklyHeatmap.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update src/components/OverviewCards.tsx**

Replace entire file:

```tsx
"use client";
import { calcCacheSavings, formatNumber, formatCurrency } from "@/lib/utils";

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

interface Props {
  totalSessions: number;
  totalMessages: number;
  modelUsage: Record<string, ModelUsage>;
}

export default function OverviewCards({ totalSessions, totalMessages, modelUsage }: Props) {
  const totalOutputTokens = Object.values(modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const devDays = totalOutputTokens / 150 / 200;
  const totalCost = Object.values(modelUsage).reduce((s, m) => s + m.costUSD, 0);
  const cacheSavings = calcCacheSavings(modelUsage);

  const cards = [
    { label: "Total Sessions",     value: totalSessions.toLocaleString(),              sub: "" },
    { label: "Total Messages",     value: formatNumber(totalMessages),                 sub: "" },
    { label: "Output Tokens",      value: formatNumber(totalOutputTokens),             sub: "" },
    { label: "Dev Days Equiv.",    value: devDays.toFixed(1),                          sub: `~${Math.round(devDays * 200).toLocaleString()} lines` },
    { label: "Total Cost",         value: formatCurrency(totalCost),                   sub: "" },
    { label: "Cache Savings",      value: formatCurrency(cacheSavings),                sub: "vs no cache" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">{c.label}</p>
          <p className="text-3xl font-bold mt-1">{c.value}</p>
          {c.sub && <p className="text-textSecondary text-xs mt-1">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update src/components/DeveloperMetrics.tsx**

Replace entire file:

```tsx
"use client";
import { calcStreaks, formatNumber } from "@/lib/utils";

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface Props {
  totalSessions: number;
  totalMessages: number;
  modelUsage: Record<string, ModelUsage>;
  dailyActivity: DailyActivity[];
}

export default function DeveloperMetrics({ totalSessions, totalMessages, modelUsage, dailyActivity }: Props) {
  const totalOutput = Object.values(modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const linesOfCode = Math.round(totalOutput / 150);
  const devDays = totalOutput / 150 / 200;
  const activeDays = dailyActivity.length;
  const avgMessages = totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
  const totalToolCalls = dailyActivity.reduce((s, d) => s + d.toolCallCount, 0);
  const { current: currentStreak, longest: longestStreak } = calcStreaks(dailyActivity.map((d) => d.date));

  const metrics = [
    { label: "Equivalent Lines of Code", value: formatNumber(linesOfCode) },
    { label: "Equivalent Dev-Days",      value: devDays.toFixed(1)        },
    { label: "Active Coding Days",       value: String(activeDays)         },
    { label: "Avg Messages / Session",   value: String(avgMessages)        },
    { label: "Total Tool Calls",         value: formatNumber(totalToolCalls) },
    { label: "Current Streak",           value: `${currentStreak} days`   },
    { label: "Longest Streak",           value: `${longestStreak} days`   },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Developer Metrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-textSecondary text-sm">{m.label}</p>
            <p className="text-2xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/components/WeeklyHeatmap.tsx**

Note: `stats-cache.json` doesn't store day-of-week × hour breakdowns. We approximate by multiplying the day-of-week weight (from `dailyActivity`) with the hour weight (from `hourCounts`).

```tsx
"use client";

interface DailyActivity {
  date: string;
  messageCount: number;
}

interface Props {
  dailyActivity: DailyActivity[];
  hourCounts: Record<string, number>;
}

const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function heatColor(intensity: number): string {
  if (intensity === 0)    return '#161b22';
  if (intensity < 0.2)    return '#0e4429';
  if (intensity < 0.4)    return '#006d32';
  if (intensity < 0.65)   return '#26a641';
  return '#39d353';
}

export default function WeeklyHeatmap({ dailyActivity, hourCounts }: Props) {
  // Accumulate message counts per day-of-week
  const dayTotals = new Array<number>(7).fill(0);
  for (const d of dailyActivity) {
    const dow = new Date(d.date + 'T12:00:00').getDay();
    dayTotals[dow] += d.messageCount;
  }
  const totalDayMsgs = dayTotals.reduce((s, v) => s + v, 0) || 1;
  const totalHourMsgs = Object.values(hourCounts).reduce((s, v) => s + v, 0) || 1;

  // Compute max joint probability for normalization
  let maxCell = 0;
  for (let dow = 0; dow < 7; dow++) {
    for (const h of HOURS) {
      const val = (dayTotals[dow] / totalDayMsgs) * ((hourCounts[String(h)] ?? 0) / totalHourMsgs);
      if (val > maxCell) maxCell = val;
    }
  }
  if (maxCell === 0) maxCell = 1;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Activity by Day &amp; Hour</h3>
      <div className="overflow-x-auto">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-10">
          {HOURS.map((h) => (
            <div key={h} className="w-5 text-center text-textSecondary" style={{ fontSize: 9 }}>
              {h % 6 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DAYS.map((day, dow) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <span className="text-xs text-textSecondary w-9 shrink-0">{day}</span>
            {HOURS.map((h) => {
              const raw = (dayTotals[dow] / totalDayMsgs) * ((hourCounts[String(h)] ?? 0) / totalHourMsgs);
              return (
                <div
                  key={h}
                  className="w-5 h-5 rounded-sm"
                  style={{ backgroundColor: heatColor(raw / maxCell) }}
                  title={`${day} ${h}:00`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-textSecondary text-xs mt-3">Approximate — derived from day-of-week and hour distributions independently</p>
    </div>
  );
}
```

- [ ] **Step 4: Update src/app/page.tsx — add WeeklyHeatmap**

Replace entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import OverviewCards from "@/components/OverviewCards";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import HourlyChart from "@/components/HourlyChart";
import TokensOverTime from "@/components/TokensOverTime";
import ModelDistribution from "@/components/ModelDistribution";
import DeveloperMetrics from "@/components/DeveloperMetrics";
import WeeklyHeatmap from "@/components/WeeklyHeatmap";

interface StatsData {
  totalSessions: number;
  totalMessages: number;
  hourCounts: Record<string, number>;
  dailyActivity: {
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }[];
  dailyModelTokens: {
    date: string;
    tokensByModel: Record<string, number>;
  }[];
  modelUsage: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }
  >;
  firstSessionDate: string;
  lastComputedDate: string;
}

export default function Home() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load stats");
        return r.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-red-400 text-lg">Error: {error}</p>
          <p className="text-textSecondary mt-2 text-sm">
            Make sure ~/.claude/stats-cache.json exists
          </p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary text-lg">Loading stats...</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Claude Code Stats</h1>
        <p className="text-textSecondary mt-1">
          Since {stats.firstSessionDate?.slice(0, 10) || "N/A"} &middot; Last updated{" "}
          {stats.lastComputedDate || "N/A"}
        </p>
      </div>

      <div className="space-y-6">
        <OverviewCards
          totalSessions={stats.totalSessions}
          totalMessages={stats.totalMessages}
          modelUsage={stats.modelUsage}
        />

        <ActivityHeatmap dailyActivity={stats.dailyActivity} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HourlyChart hourCounts={stats.hourCounts} />
          <ModelDistribution modelUsage={stats.modelUsage} />
        </div>

        <WeeklyHeatmap
          dailyActivity={stats.dailyActivity}
          hourCounts={stats.hourCounts}
        />

        <TokensOverTime dailyModelTokens={stats.dailyModelTokens} />

        <DeveloperMetrics
          totalSessions={stats.totalSessions}
          totalMessages={stats.totalMessages}
          modelUsage={stats.modelUsage}
          dailyActivity={stats.dailyActivity}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify Overview page renders with 6 cards + WeeklyHeatmap + streak metrics**

```bash
npm run dev
```

Open http://localhost:3847. Check: 6 overview cards visible (2 new: Total Cost, Cache Savings), WeeklyHeatmap section at bottom of main content, DeveloperMetrics shows Current Streak and Longest Streak.

- [ ] **Step 6: Commit**

```bash
git add src/components/OverviewCards.tsx src/components/DeveloperMetrics.tsx \
        src/components/WeeklyHeatmap.tsx src/app/page.tsx
git commit -m "feat: enhance overview page with cost, cache savings, streak, weekly heatmap"
```

---

## Task 4: Tokens page

**Files:**
- Create: `src/app/tokens/page.tsx`
- Create: `src/components/TokenBreakdown.tsx`
- Create: `src/components/CacheEfficiency.tsx`
- Create: `src/components/ModelCostChart.tsx`

- [ ] **Step 1: Create src/components/TokenBreakdown.tsx**

```tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const TYPE_COLORS = {
  inputTokens:             "#3b82f6",
  outputTokens:            "#a855f7",
  cacheReadInputTokens:    "#22c55e",
  cacheCreationInputTokens:"#f59e0b",
};

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

function shortName(m: string): string {
  if (m.includes("opus"))   return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku"))  return "Haiku";
  return m;
}

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}

export default function TokenBreakdown({ modelUsage }: { modelUsage: Record<string, ModelUsage> }) {
  const data = Object.entries(modelUsage).map(([model, u]) => ({
    name: shortName(model),
    inputTokens: u.inputTokens,
    outputTokens: u.outputTokens,
    cacheReadInputTokens: u.cacheReadInputTokens,
    cacheCreationInputTokens: u.cacheCreationInputTokens,
  }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Token Breakdown by Model</h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 70)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tickFormatter={fmt} tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} width={55} />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [fmt(v)]}
          />
          <Legend />
          <Bar dataKey="inputTokens"              stackId="a" fill={TYPE_COLORS.inputTokens}              name="Input"       />
          <Bar dataKey="outputTokens"             stackId="a" fill={TYPE_COLORS.outputTokens}             name="Output"      />
          <Bar dataKey="cacheReadInputTokens"     stackId="a" fill={TYPE_COLORS.cacheReadInputTokens}     name="Cache Read"  />
          <Bar dataKey="cacheCreationInputTokens" stackId="a" fill={TYPE_COLORS.cacheCreationInputTokens} name="Cache Write" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create src/components/CacheEfficiency.tsx**

```tsx
"use client";
import { calcCacheSavings, formatNumber, formatCurrency } from "@/lib/utils";

interface ModelUsage {
  inputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  [key: string]: number;
}

export default function CacheEfficiency({ modelUsage }: { modelUsage: Record<string, ModelUsage> }) {
  const totalInput       = Object.values(modelUsage).reduce((s, m) => s + m.inputTokens, 0);
  const totalCacheRead   = Object.values(modelUsage).reduce((s, m) => s + m.cacheReadInputTokens, 0);
  const totalCacheCreate = Object.values(modelUsage).reduce((s, m) => s + m.cacheCreationInputTokens, 0);
  const totalAll         = totalInput + totalCacheRead + totalCacheCreate;
  const hitRate          = totalAll > 0 ? (totalCacheRead / totalAll) * 100 : 0;
  const savings          = calcCacheSavings(modelUsage);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Cache Efficiency</h3>
      <div className="space-y-5">
        <div>
          <p className="text-textSecondary text-sm">Cache Hit Rate</p>
          <p className="text-4xl font-bold mt-1">{hitRate.toFixed(1)}%</p>
          <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${hitRate}%` }} />
          </div>
        </div>
        <div>
          <p className="text-textSecondary text-sm">Saved via Cache</p>
          <p className="text-4xl font-bold mt-1">{formatCurrency(savings)}</p>
          <p className="text-textSecondary text-xs mt-1">{formatNumber(totalCacheRead)} tokens served from cache</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/components/ModelCostChart.tsx**

```tsx
"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6":           "#a855f7",
  "claude-sonnet-4-6":         "#3b82f6",
  "claude-haiku-4-5-20251001": "#22c55e",
};

function shortName(m: string): string {
  if (m.includes("opus"))   return "Opus";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku"))  return "Haiku";
  return m;
}

export default function ModelCostChart({ modelUsage }: { modelUsage: Record<string, { costUSD: number }> }) {
  const data = Object.entries(modelUsage)
    .filter(([, u]) => u.costUSD > 0)
    .map(([model, u]) => ({ name: shortName(model), fullName: model, value: u.costUSD }));

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={55} outerRadius={90}
            dataKey="value" nameKey="name"
            stroke="#0d1117" strokeWidth={2}
          >
            {data.map((e) => (
              <Cell key={e.fullName} fill={MODEL_COLORS[e.fullName] ?? "#6b7280"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Create src/app/tokens/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import TokenBreakdown from "@/components/TokenBreakdown";
import CacheEfficiency from "@/components/CacheEfficiency";
import ModelCostChart from "@/components/ModelCostChart";
import { formatNumber, formatCurrency } from "@/lib/utils";

interface StatsData {
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}

export default function TokensPage() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading...</p>
      </div>
    );
  }

  const totalInput     = Object.values(stats.modelUsage).reduce((s, m) => s + m.inputTokens, 0);
  const totalOutput    = Object.values(stats.modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const totalCacheRead = Object.values(stats.modelUsage).reduce((s, m) => s + m.cacheReadInputTokens, 0);
  const totalCost      = Object.values(stats.modelUsage).reduce((s, m) => s + m.costUSD, 0);

  const summaryCards = [
    { label: "Total Input Tokens",  value: formatNumber(totalInput)     },
    { label: "Total Output Tokens", value: formatNumber(totalOutput)    },
    { label: "Cache Read Tokens",   value: formatNumber(totalCacheRead) },
    { label: "Total Cost",          value: formatCurrency(totalCost)    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Token Usage</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-lg p-5">
            <p className="text-textSecondary text-sm">{c.label}</p>
            <p className="text-3xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <TokenBreakdown modelUsage={stats.modelUsage} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CacheEfficiency modelUsage={stats.modelUsage} />
          <ModelCostChart modelUsage={stats.modelUsage} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify Tokens page renders correctly**

Open http://localhost:3847/tokens. Check: 4 summary cards, stacked bar chart per model, cache efficiency panel with hit rate bar, cost donut.

- [ ] **Step 6: Commit**

```bash
git add src/app/tokens/page.tsx src/components/TokenBreakdown.tsx \
        src/components/CacheEfficiency.tsx src/components/ModelCostChart.tsx
git commit -m "feat: add tokens page with breakdown, cache efficiency, cost charts"
```

---

## Task 5: /api/projects route

**Files:**
- Create: `src/app/api/projects/route.ts`

- [ ] **Step 1: Create src/app/api/projects/route.ts**

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import type { ProjectStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, "-");
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, "");
    return rest || dirName;
  }
  return dirName.replace(/^-/, "");
}

export async function GET() {
  try {
    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    if (!fs.existsSync(projectsDir)) return NextResponse.json([]);

    const homeDir = os.homedir();
    const results: ProjectStats[] = [];

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectDir = path.join(projectsDir, entry.name);
      const jsonlFiles = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

      let messageCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const dates = new Set<string>();
      let firstDate = "";
      let lastDate = "";

      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file);
        const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as Record<string, unknown>;
            if (
              msg.type === "user" &&
              !msg.toolUseResult &&
              !msg.isMeta
            ) {
              messageCount++;
              const ts = msg.timestamp as string | undefined;
              if (ts) {
                const date = ts.slice(0, 10);
                dates.add(date);
                if (!firstDate || date < firstDate) firstDate = date;
                if (!lastDate || date > lastDate) lastDate = date;
              }
            }
            if (msg.type === "assistant") {
              const message = msg.message as Record<string, unknown> | undefined;
              const usage = message?.usage as Record<string, number> | undefined;
              if (usage) {
                inputTokens +=
                  (usage.input_tokens ?? 0) +
                  (usage.cache_read_input_tokens ?? 0) +
                  (usage.cache_creation_input_tokens ?? 0);
                outputTokens += usage.output_tokens ?? 0;
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (messageCount > 0) {
        results.push({
          id: entry.name,
          displayName: decodeProjectName(entry.name, homeDir),
          messageCount,
          inputTokens,
          outputTokens,
          firstDate,
          lastDate,
          activeDays: dates.size,
        });
      }
    }

    results.sort((a, b) => b.messageCount - a.messageCount);
    return NextResponse.json(results);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify API returns data**

```bash
curl http://localhost:3847/api/projects | python3 -m json.tool | head -40
```

Expected: JSON array of project objects with `id`, `displayName`, `messageCount`, `inputTokens`, `outputTokens`, `firstDate`, `lastDate`, `activeDays`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/projects/route.ts
git commit -m "feat: add /api/projects route"
```

---

## Task 6: Projects page

**Files:**
- Create: `src/components/ProjectChart.tsx`
- Create: `src/components/ProjectTable.tsx`
- Create: `src/app/projects/page.tsx`

- [ ] **Step 1: Create src/components/ProjectChart.tsx**

```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ProjectStats } from "@/lib/types";

export default function ProjectChart({ projects }: { projects: ProjectStats[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="text-textPrimary font-semibold mb-4">Top Projects by Messages</h3>
      <ResponsiveContainer width="100%" height={Math.max(250, projects.length * 32)}>
        <BarChart data={projects} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
          <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            width={170}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            formatter={(v: number) => [v.toLocaleString(), "Messages"]}
          />
          <Bar dataKey="messageCount" name="Messages" fill="#3b82f6" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create src/components/ProjectTable.tsx**

```tsx
"use client";
import type { ProjectStats } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function ProjectTable({ projects }: { projects: ProjectStats[] }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <h3 className="text-textPrimary font-semibold p-5 border-b border-border">All Projects</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-textSecondary font-medium">Project</th>
              <th className="text-right p-3 text-textSecondary font-medium">Messages</th>
              <th className="text-right p-3 text-textSecondary font-medium">Tokens</th>
              <th className="text-right p-3 text-textSecondary font-medium">Active Days</th>
              <th className="text-right p-3 text-textSecondary font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-bg transition-colors">
                <td className="p-3 text-textPrimary max-w-xs">
                  <span className="block truncate" title={p.displayName}>{p.displayName}</span>
                </td>
                <td className="p-3 text-right tabular-nums">{formatNumber(p.messageCount)}</td>
                <td className="p-3 text-right tabular-nums text-textSecondary">
                  {formatNumber(p.inputTokens + p.outputTokens)}
                </td>
                <td className="p-3 text-right tabular-nums">{p.activeDays}</td>
                <td className="p-3 text-right text-textSecondary">{p.lastDate.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/app/projects/page.tsx**

```tsx
"use client";
import { useEffect, useState } from "react";
import ProjectChart from "@/components/ProjectChart";
import ProjectTable from "@/components/ProjectTable";
import { formatNumber } from "@/lib/utils";
import type { ProjectStats } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading projects...</p>
      </div>
    );
  }

  const totalMessages = projects.reduce((s, p) => s + p.messageCount, 0);
  const mostActive    = projects[0];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Projects</p>
          <p className="text-3xl font-bold mt-1">{projects.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Most Active</p>
          <p className="text-xl font-bold mt-1 truncate" title={mostActive?.displayName}>
            {mostActive?.displayName ?? "—"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Messages</p>
          <p className="text-3xl font-bold mt-1">{formatNumber(totalMessages)}</p>
        </div>
      </div>

      <div className="space-y-6">
        <ProjectChart projects={projects.slice(0, 10)} />
        <ProjectTable projects={projects} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify Projects page**

Open http://localhost:3847/projects. Check: 3 summary cards, horizontal bar chart of top 10 projects, full table of all projects with sortable columns.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectChart.tsx src/components/ProjectTable.tsx \
        src/app/projects/page.tsx
git commit -m "feat: add projects page with chart and table"
```

---

## Task 7: /api/prompts route

**Files:**
- Create: `src/app/api/prompts/route.ts`

- [ ] **Step 1: Create src/app/api/prompts/route.ts**

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import type { PromptEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, "-");
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, "");
    return rest || dirName;
  }
  return dirName.replace(/^-/, "");
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("\n");
  }
  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project") ?? "";
  const search    = (searchParams.get("search") ?? "").toLowerCase();
  const from      = searchParams.get("from") ?? "";
  const to        = searchParams.get("to")   ?? "";

  try {
    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    if (!fs.existsSync(projectsDir)) return NextResponse.json([]);

    const homeDir  = os.homedir();
    const prompts: PromptEntry[] = [];

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => !projectId || e.name === projectId);

    for (const entry of entries) {
      const projectDir  = path.join(projectsDir, entry.name);
      const projectName = decodeProjectName(entry.name, homeDir);
      const jsonlFiles  = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        const lines = fs.readFileSync(path.join(projectDir, file), "utf-8")
          .split("\n")
          .filter(Boolean);

        let pendingPrompt: PromptEntry | null = null;

        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as Record<string, unknown>;

            if (msg.type === "user" && !msg.toolUseResult && !msg.isMeta) {
              const content = extractText((msg.message as Record<string, unknown>)?.content);
              if (!content.trim()) continue;

              const ts   = (msg.timestamp as string | undefined) ?? "";
              const date = ts.slice(0, 10);

              if ((from && date < from) || (to && date > to)) continue;
              if (search && !content.toLowerCase().includes(search)) continue;

              pendingPrompt = {
                id:          `${entry.name}:${file}:${ts}`,
                projectId:   entry.name,
                projectName,
                timestamp:   ts,
                content,
                inputTokens:  0,
                outputTokens: 0,
              };
              prompts.push(pendingPrompt);
            } else if (msg.type === "assistant" && pendingPrompt) {
              const message = msg.message as Record<string, unknown> | undefined;
              const usage   = message?.usage as Record<string, number> | undefined;
              if (usage) {
                pendingPrompt.inputTokens  = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
                pendingPrompt.outputTokens = usage.output_tokens ?? 0;
              }
              pendingPrompt = null;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    prompts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return NextResponse.json(prompts);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify API returns prompts**

```bash
curl "http://localhost:3847/api/prompts?search=tokens" | python3 -m json.tool | head -30
```

Expected: JSON array of PromptEntry objects. Each has `id`, `projectId`, `projectName`, `timestamp`, `content`, `inputTokens`, `outputTokens`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/prompts/route.ts
git commit -m "feat: add /api/prompts route"
```

---

## Task 8: Prompts page

**Files:**
- Create: `src/components/PromptList.tsx`
- Create: `src/components/PromptAnalysis.tsx`
- Create: `src/app/prompts/page.tsx`

- [ ] **Step 1: Create src/components/PromptList.tsx**

```tsx
"use client";
import { useState } from "react";
import type { PromptEntry } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function PromptList({ prompts }: { prompts: PromptEntry[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-3 border-b border-border text-textSecondary text-sm">
        {prompts.length.toLocaleString()} prompts
      </div>
      <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
        {prompts.map((p) => (
          <div
            key={p.id}
            className="p-4 hover:bg-bg cursor-pointer transition-colors"
            onClick={() => toggle(p.id)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-textSecondary">
                {p.timestamp.slice(0, 16).replace("T", " ")}
              </span>
              <span className="text-xs bg-border rounded px-1.5 py-0.5 text-textSecondary truncate max-w-[180px]">
                {p.projectName}
              </span>
              {p.outputTokens > 0 && (
                <span className="text-xs text-textSecondary ml-auto">
                  {formatNumber(p.outputTokens)} out
                </span>
              )}
            </div>
            <p className="text-sm text-textPrimary whitespace-pre-wrap break-words">
              {expanded.has(p.id)
                ? p.content
                : p.content.slice(0, 160) + (p.content.length > 160 ? "…" : "")}
            </p>
          </div>
        ))}
        {prompts.length === 0 && (
          <div className="p-8 text-center text-textSecondary text-sm">No prompts found</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create src/components/PromptAnalysis.tsx**

```tsx
"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { topWords } from "@/lib/utils";
import type { PromptEntry } from "@/lib/types";

export default function PromptAnalysis({ prompts }: { prompts: PromptEntry[] }) {
  const words = useMemo(() => topWords(prompts.map((p) => p.content), 15), [prompts]);

  const lengthBuckets = useMemo(() => {
    const b = { Short: 0, Medium: 0, Long: 0 };
    for (const p of prompts) {
      const l = p.content.length;
      if (l < 100)       b.Short++;
      else if (l < 500)  b.Medium++;
      else               b.Long++;
    }
    return Object.entries(b).map(([name, count]) => ({ name, count }));
  }, [prompts]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-textPrimary font-semibold mb-3">Top Words</h3>
        <div className="space-y-2">
          {words.map(({ word, count }) => (
            <div key={word} className="flex items-center gap-2 text-sm">
              <span className="text-textPrimary w-28 truncate">{word}</span>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(count / (words[0]?.count ?? 1)) * 100}%` }}
                />
              </div>
              <span className="text-textSecondary text-xs w-8 text-right tabular-nums">{count}</span>
            </div>
          ))}
          {words.length === 0 && (
            <p className="text-textSecondary text-sm">No data</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-textPrimary font-semibold mb-3">Prompt Length</h3>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={lengthBuckets} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: 6 }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-textSecondary text-xs mt-1">Short &lt;100 chars · Medium 100–500 · Long &gt;500</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/app/prompts/page.tsx**

```tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import PromptList from "@/components/PromptList";
import PromptAnalysis from "@/components/PromptAnalysis";
import type { PromptEntry } from "@/lib/types";

export default function PromptsPage() {
  const [prompts, setPrompts]         = useState<PromptEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => {
        setPrompts(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of prompts) {
      if (!seen.has(p.projectId)) seen.set(p.projectId, p.projectName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [prompts]);

  const filtered = useMemo(
    () =>
      prompts.filter((p) => {
        if (projectFilter && p.projectId !== projectFilter) return false;
        if (search && !p.content.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [prompts, search, projectFilter]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading prompts...</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Prompt History</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-blue-500 flex-1 min-w-48"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-blue-500"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PromptList prompts={filtered} />
        </div>
        <div>
          <PromptAnalysis prompts={prompts} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify Prompts page**

Open http://localhost:3847/prompts. Check: search input and project dropdown filter, scrollable prompt list (click to expand), top words and length distribution on right.

- [ ] **Step 5: Commit**

```bash
git add src/components/PromptList.tsx src/components/PromptAnalysis.tsx \
        src/app/prompts/page.tsx
git commit -m "feat: add prompts history page with search, filter, and word analysis"
```

---

## Task 9: Export PNG

**Files:**
- Create: `src/components/ExportButton.tsx`
- Modify: `src/app/page.tsx` (add export button + wrapper id)
- Modify: `src/app/tokens/page.tsx` (same)
- Modify: `src/app/projects/page.tsx` (same)
- Modify: `src/app/prompts/page.tsx` (same)

- [ ] **Step 1: Install html2canvas**

```bash
npm install html2canvas
npm install -D @types/html2canvas
```

- [ ] **Step 2: Create src/components/ExportButton.tsx**

```tsx
"use client";

export default function ExportButton({ targetId, filename }: { targetId: string; filename: string }) {
  const handleExport = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const el = document.getElementById(targetId);
    if (!el) return;

    // Temporarily hide this button before capture
    const btn = el.querySelector("[data-export-hide]") as HTMLElement | null;
    if (btn) btn.style.visibility = "hidden";

    const canvas = await html2canvas(el, { backgroundColor: "#0d1117", scale: 2, useCORS: true });

    if (btn) btn.style.visibility = "";

    const link = document.createElement("a");
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <button
      data-export-hide
      onClick={handleExport}
      className="text-sm text-textSecondary hover:text-textPrimary border border-border rounded-lg px-3 py-1.5 transition-colors"
    >
      Export PNG
    </button>
  );
}
```

- [ ] **Step 3: Add ExportButton to Overview page (src/app/page.tsx)**

In the `<main>` opening tag, add `id="export-overview"`. Add ExportButton import and the button in the header row:

Replace the `<div className="mb-8">` block with:

```tsx
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Claude Code Stats</h1>
          <p className="text-textSecondary mt-1">
            Since {stats.firstSessionDate?.slice(0, 10) || "N/A"} &middot; Last updated{" "}
            {stats.lastComputedDate || "N/A"}
          </p>
        </div>
        <ExportButton targetId="export-overview" filename={`claude-stats-overview-${new Date().toISOString().slice(0,10)}.png`} />
      </div>
```

Change `<main className="max-w-7xl mx-auto px-4 py-8">` to `<main id="export-overview" className="max-w-7xl mx-auto px-4 py-8">`.

Add import at top: `import ExportButton from "@/components/ExportButton";`

- [ ] **Step 4: Add ExportButton to Tokens page (src/app/tokens/page.tsx)**

Change `<main className="max-w-7xl mx-auto px-4 py-8">` to `<main id="export-tokens" className="max-w-7xl mx-auto px-4 py-8">`.

Replace `<h1 className="text-2xl font-bold mb-6">Token Usage</h1>` with:

```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Token Usage</h1>
        <ExportButton targetId="export-tokens" filename={`claude-stats-tokens-${new Date().toISOString().slice(0,10)}.png`} />
      </div>
```

Add import at top: `import ExportButton from "@/components/ExportButton";`

- [ ] **Step 5: Add ExportButton to Projects page (src/app/projects/page.tsx)**

Change `<main className="max-w-7xl mx-auto px-4 py-8">` to `<main id="export-projects" className="max-w-7xl mx-auto px-4 py-8">`.

Replace `<h1 className="text-2xl font-bold mb-6">Projects</h1>` with:

```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <ExportButton targetId="export-projects" filename={`claude-stats-projects-${new Date().toISOString().slice(0,10)}.png`} />
      </div>
```

Add import: `import ExportButton from "@/components/ExportButton";`

- [ ] **Step 6: Add ExportButton to Prompts page (src/app/prompts/page.tsx)**

Change `<main className="max-w-7xl mx-auto px-4 py-8">` to `<main id="export-prompts" className="max-w-7xl mx-auto px-4 py-8">`.

Replace `<h1 className="text-2xl font-bold mb-6">Prompt History</h1>` with:

```tsx
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prompt History</h1>
        <ExportButton targetId="export-prompts" filename={`claude-stats-prompts-${new Date().toISOString().slice(0,10)}.png`} />
      </div>
```

Add import: `import ExportButton from "@/components/ExportButton";`

- [ ] **Step 7: Verify export works on each page**

Open each page, click "Export PNG", verify a PNG file downloads with correct filename and captures the full page content.

- [ ] **Step 8: Commit**

```bash
git add src/components/ExportButton.tsx src/app/page.tsx src/app/tokens/page.tsx \
        src/app/projects/page.tsx src/app/prompts/page.tsx package.json package-lock.json
git commit -m "feat: add Export PNG button to all pages"
```

---

## Done

All 4 pages should now be working. Verify end-to-end:

1. `npm run dev` — server starts on port 3847
2. `/` — Overview with 6 cards, streak, weekly heatmap
3. `/tokens` — Token breakdown, cache efficiency, cost donut
4. `/projects` — Bar chart + table of all projects
5. `/prompts` — Searchable history + word analysis
6. Each page has "Export PNG" in top-right corner
