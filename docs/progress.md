# Progress — claude-stats

## Overview

本地 Claude Code 使用情况 dashboard。数据存储于 SQLite (`~/.claude/claude-stats.db`)，通过 Next.js 展示 token 消耗趋势、费用燃尽、5 小时速率限制窗口等图表。数据采集由 Claude Code Stop hook 自动触发 + 页面手动刷新。

## Phases

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 基础 dashboard：主页费用 overview，token/cost 趋势图 | 完成 |
| 2 | Usage 窗口追踪：5h 窗口燃尽图 + 小时/周粒度图表 + Stop hook 自动采集 | 完成 |
| 3 | SQLite 迁移 + Dashboard 重构 | 完成 |
| 4 | 部署 & 分发（Vercel / 本地一键启动文档） | 未开始 |

## Next

- Phase 4：评估部署方案
- 完善 AI Analysis：流式输出、分析结果缓存
- WeeklyHeatmap 改用真实 per-day-per-hour 数据（目前是独立分布的近似）
- Prompts 页 AI 分析传入当前筛选条件（project/date filter）

## Log

### 2026-04-20

- Done:
  - **SQLite 迁移**：全部数据存入 `~/.claude/claude-stats.db`（messages/usage_windows/window_timeline/processed_files 四张表），增量采集，`collect-to-db.mjs` 替代旧脚本
  - **API 重写**：6 个 route 全部改查 SQLite，支持分页/时间范围/搜索过滤，新增 `/api/tokens`、`/api/usage/[id]/timeline`、`/api/collect`、`/api/analyze`
  - **Overview 页**：合并 KPI 卡片（8 个卡片 2×4 布局），删除底部 Developer Metrics 重复区域
  - **Activity Heatmap**：GitHub 风格 hover tooltip（日期 + 消息数 + 会话数），相对 5 级色标
  - **Activity by Day & Hour**：轴翻转为日历视图（横=周几，纵=小时），时间范围选择器（7/30/90/All），起始小时选择器，UTC→本地时区转换
  - **Tooltip 统一**：抽取 `CHART_TOOLTIP_STYLE` 常量，修复 Model Distribution 饼图黑字看不清问题
  - **Token Breakdown**：柱状图/饼图切换按钮
  - **Prompts 页**：分页加载，关键词 X 删除（localStorage 持久化），AI 分析按钮（调用本地 claude CLI），用户自定义分析引导输入
  - **Usage 页**：窗口分页，burndown 图叠加历史平均使用模式曲线（灰色虚线）
  - **Nav**：刷新按钮 + Last Updated 时间戳
  - **ProjectChart**：显示短项目名，hover 展示完整路径
  - **代码审查修复**：project name 解码 bug、SQLite busy_timeout、过时错误提示
- Next: Phase 4 部署评估

### 2026-04-13

- Done:
  - 实现 `scripts/collect-usage.mjs`：扫描全部 JSONL → 5h 滚动窗口分组 → 写入 `~/.claude/usage-windows-cache.json`
  - 实现 `scripts/install-hook.mjs`：自动注册 Claude Code Stop hook
  - 新增 `/api/usage` route 读取缓存文件
  - 新增 `/usage` 页面，含三个图表：WindowBurndownChart、HourlyUsageChart、WeeklyUsageChart
  - Nav 增加 Usage tab
  - 修复：path import 去重、missing settings.json guard、hour label 格式
- Next: Phase 3 SQLite 迁移
