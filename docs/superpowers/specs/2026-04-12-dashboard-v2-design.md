# Claude Stats Dashboard v2 — Design Spec

**Date:** 2026-04-12  
**Status:** Approved

---

## Overview

Expand the claude-stats dashboard from a single-page overview into a 4-page multi-tab application. New pages cover token cost/efficiency details, per-project breakdown, and a searchable prompt history with analysis.

**Sharing use case:** Screenshots/PNG export. No multi-user auth required.

---

## Navigation

Top tab bar with 4 routes (Next.js App Router):

| Tab | Route | Status |
|---|---|---|
| Overview | `/` | Existing (enhanced) |
| Tokens | `/tokens` | New |
| Projects | `/projects` | New |
| Prompts | `/prompts` | New |

---

## Page 1: Overview (enhanced)

### Changes to existing page

**OverviewCards** — add 2 new cards:
- **Total Cost**: sum of `modelUsage[model].costUSD` across all models, formatted as `$X.XX`
- **Cache Savings**: estimated savings = `cacheReadInputTokens * (inputPrice - cacheReadPrice)` per model, formatted as `$X.XX`

**DeveloperMetrics** — add 2 new metrics:
- **Current Streak**: consecutive days with at least 1 message up to today
- **Longest Streak**: maximum consecutive active days ever

**New component: WeeklyHeatmap** — 7×24 matrix (day-of-week × hour), colored by message density. Inserted as a new section below the existing `HourlyChart` (HourlyChart is kept). Shows when the user is most active during the week.

---

## Page 2: Tokens (`/tokens`)

**Data source:** `stats-cache.json` → `modelUsage` (already has inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD per model). Daily cost requires deriving from `dailyModelTokens` + per-model token prices.

### Layout

**Overview Cards (4):**
- Total Input Tokens
- Total Output Tokens  
- Total Cache Read Tokens
- Total Cost

**Token Breakdown Chart:**  
One stacked horizontal bar per model showing 4 segments: `inputTokens` | `outputTokens` | `cacheReadTokens` | `cacheCreationTokens`. Color-coded by type, not by model.

**Cost Analysis (2 charts side by side):**
- Daily cost line chart (x = date, y = USD, one line per model) — derived from `dailyModelTokens` × token prices
- Model cost distribution donut chart (using `costUSD` per model)

**Cache Efficiency Panel:**
- Cache Hit Rate = `cacheReadInputTokens / (inputTokens + cacheReadInputTokens + cacheCreationInputTokens)`
- Big number card: "Saved $X.XX via cache" (cache read is ~10x cheaper than input)
- Secondary stat: "X tokens served from cache"

---

## Page 3: Projects (`/projects`)

**Data source:** New `/api/projects` route that:
1. Reads `~/.claude/projects/` directory structure to enumerate projects
2. Maps each project to its transcript files in `~/.claude/transcripts/`
3. Aggregates per-project: messageCount, tokenCount (if available), lastActiveDate, activeDays

### Layout

**Overview Cards (3):**
- Total Projects
- Most Active Project (name)
- Total Cost Across Projects

**Project Leaderboard Table:**

Columns: Project Name | Messages | Tokens | Cost | Last Active | Active Days

- Sorted by message count by default
- Clicking a row expands inline to show a mini timeline for that project (daily message count bar chart)

**Project Distribution Chart:**  
Horizontal bar chart, top 10 projects by message count, sorted descending.

---

## Page 4: Prompts (`/prompts`)

**Data source:** New `/api/prompts` route that reads `~/.claude/transcripts/*.jsonl`, extracts lines where `type === "user"` (or equivalent), and returns: timestamp, projectName (from file path), content, tokenCount (if present).

### Layout

**Filter Bar (top):**
- Full-text search input (client-side filter on loaded data)
- Project dropdown (from available project names)
- Date range picker (start date / end date)

**Prompt List (main body):**

Each item shows:
- Timestamp + project name
- First 150 characters of prompt content (click to expand full text)
- Token count if available

Virtualized list for performance (react-window or similar) if prompt count > 500.

**Analysis Panel (below or collapsible sidebar):**
- **Top 20 Words**: frequency count after filtering stop words (English + Chinese), displayed as a ranked list or simple bar chart
- **Prompt Length Distribution**: histogram bucketed into Short (<50 tokens), Medium (50–200), Long (200+)
- **Daily Prompt Count Trend**: small line chart showing prompts per day over time

---

## Export Feature

Each page has an **Export PNG** button in the top-right corner.

- Uses `html2canvas` to capture the current viewport
- Downloads as `claude-stats-[page]-YYYY-MM-DD.png`
- Button is hidden during capture (excluded via CSS class)

---

## New API Routes

| Route | Source | Returns |
|---|---|---|
| `/api/projects` | `~/.claude/projects/` + transcripts | Per-project aggregated stats |
| `/api/prompts` | `~/.claude/transcripts/*.jsonl` | Flat list of user messages with metadata |

The existing `/api/transcripts` route (currently unused) should be evaluated for reuse or replacement by `/api/prompts`.

---

## New Dependencies

| Package | Purpose |
|---|---|
| `html2canvas` | Export PNG screenshots |
| `react-window` (optional) | Virtualized list for large prompt history |

No new charting libraries needed — all new charts use existing Recharts.

---

## Out of Scope

- Multi-user access / authentication
- Public deployment / hosted sharing
- Real-time data sync (dashboard refreshes on page load only)
- Mobile layout optimization
