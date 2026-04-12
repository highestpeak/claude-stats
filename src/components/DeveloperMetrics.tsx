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
