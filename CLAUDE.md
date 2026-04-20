# claude-stats

本地运行的 Claude Code 使用情况可视化 dashboard。读取 `~/.claude/projects/**/*.jsonl`，展示 token 消耗、费用燃尽图、Usage 窗口等。

## Progress

→ `docs/progress.md`（每次对话开始时读它）

## Tech Stack

- Next.js 14 App Router + TypeScript
- Tailwind CSS + Recharts 2.x
- Vitest（单元测试）
- Node.js ESM scripts（数据采集，不依赖 Next.js）

## Architecture

```
scripts/collect-to-db.mjs     数据采集脚本，由 Claude Code Stop hook 触发，写入 SQLite
scripts/install-hook.mjs      一次性注册 Stop hook 到 ~/.claude/settings.json
src/app/                      Next.js pages
  page.tsx                    主页（费用 overview）
  usage/page.tsx              Usage 页（5h 窗口图表）
  api/usage/route.ts          查询 SQLite，返回分页窗口列表
src/components/               图表组件（WindowBurndownChart, HourlyUsageChart, WeeklyUsageChart）
src/lib/
  db.ts                       SQLite 连接 + query helpers
  types.ts                    共享类型
  utils.ts                    纯函数（groupIntoWindows 等）
  utils.test.ts               Vitest 测试
```

## Dev Rules

- 数据采集逻辑放 `scripts/`，不进 Next.js 运行时
- 图表组件保持 pure（只接 props，不 fetch）
- API route 只读缓存文件，不做计算
