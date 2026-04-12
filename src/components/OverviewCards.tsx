"use client";

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

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function OverviewCards({ totalSessions, totalMessages, modelUsage }: Props) {
  const totalOutputTokens = Object.values(modelUsage).reduce((s, m) => s + m.outputTokens, 0);
  const devDays = totalOutputTokens / 150 / 200;

  const cards = [
    { label: "Total Sessions", value: totalSessions.toLocaleString(), sub: "" },
    { label: "Total Messages", value: formatNumber(totalMessages), sub: "" },
    { label: "Output Tokens", value: formatNumber(totalOutputTokens), sub: "" },
    { label: "Dev Days Equivalent", value: devDays.toFixed(1), sub: `~${Math.round(devDays * 200).toLocaleString()} lines` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
