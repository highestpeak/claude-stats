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
