# claude-stats

A local dashboard for visualizing your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) usage — token consumption, cost burndown, and usage windows.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- Token consumption breakdown by project and session
- Cost burndown chart with daily/weekly granularity
- 5-hour usage window visualization
- Automatic data collection via Claude Code stop hook
- SQLite-backed storage for fast queries

## Quick Start

```bash
# Install dependencies
npm install

# Install the Claude Code stop hook (one-time setup)
node scripts/install-hook.mjs

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## How It Works

1. **Data Collection** — A stop hook (`scripts/collect-to-db.mjs`) runs after each Claude Code session, parsing JSONL logs from `~/.claude/projects/` and writing usage data to a local SQLite database.

2. **API** — Next.js API routes query SQLite and return structured data.

3. **Dashboard** — React + Recharts renders interactive charts for cost tracking and usage patterns.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Database:** SQLite (via better-sqlite3)
- **Testing:** Vitest

## Development

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run test      # Run tests
```

## License

MIT
