"use client";
import { calcStreaks, calcCacheSavings, formatNumber, formatCurrency } from "@/lib/utils";

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

export default function OverviewCards({ totalSessions, totalMessages, modelUsage, dailyActivity }: Props) {
  const totalOutputTokens = Object.values(modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const devDays = totalOutputTokens / 150 / 200;
  const totalCost = Object.values(modelUsage).reduce((s, m) => s + m.costUSD, 0);
  const cacheSavings = calcCacheSavings(modelUsage);
  const { current: currentStreak } = calcStreaks(dailyActivity.map((d) => d.date));
  const activeDays = dailyActivity.length;

  const row1 = [
    { label: "Total Sessions",  value: totalSessions.toLocaleString(),  sub: "" },
    { label: "Total Messages",  value: formatNumber(totalMessages),      sub: "" },
    { label: "Output Tokens",   value: formatNumber(totalOutputTokens),  sub: "" },
    { label: "Total Cost",      value: formatCurrency(totalCost),        sub: "" },
  ];

  const row2 = [
    { label: "Dev Days Equiv.", value: devDays.toFixed(1),              sub: `~${Math.round(devDays * 200).toLocaleString()} lines` },
    { label: "Cache Savings",   value: formatCurrency(cacheSavings),    sub: "vs no cache" },
    { label: "Active Days",     value: String(activeDays),              sub: "" },
    { label: "Current Streak",  value: `${currentStreak} days`,        sub: "" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...row1, ...row2].map((c) => (
        <div key={c.label} className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">{c.label}</p>
          <p className="text-3xl font-bold mt-1">{c.value}</p>
          {c.sub && <p className="text-textSecondary text-xs mt-1">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
