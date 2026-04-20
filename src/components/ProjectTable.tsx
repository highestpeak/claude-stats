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
              <th className="text-right p-3 text-textSecondary font-medium">Total Tokens</th>
              <th className="text-right p-3 text-textSecondary font-medium">No Cache</th>
              <th className="text-right p-3 text-textSecondary font-medium">Cache Hit</th>
              <th className="text-right p-3 text-textSecondary font-medium">Active Days</th>
              <th className="text-right p-3 text-textSecondary font-medium">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const total = p.inputTokens + p.outputTokens + p.cacheReadTokens + p.cacheCreationTokens;
              const noCache = p.inputTokens + p.outputTokens;
              // Cache hit rate: cache_read / (input + cache_read) — what % of input was served from cache
              const cacheHitDenom = p.inputTokens + p.cacheReadTokens;
              const cacheHitPct = cacheHitDenom > 0 ? ((p.cacheReadTokens / cacheHitDenom) * 100).toFixed(1) : '0';
              return (
                <tr key={p.id} className="border-b border-border hover:bg-bg transition-colors">
                  <td className="p-3 text-textPrimary max-w-xs">
                    <span className="block truncate" title={p.displayName}>{p.displayName}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatNumber(p.messageCount)}</td>
                  <td className="p-3 text-right tabular-nums"
                    title={`Input: ${formatNumber(p.inputTokens)}\nOutput: ${formatNumber(p.outputTokens)}\nCache Read: ${formatNumber(p.cacheReadTokens)}\nCache Create: ${formatNumber(p.cacheCreationTokens)}`}
                  >
                    {formatNumber(total)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-textSecondary"
                    title={`Input: ${formatNumber(p.inputTokens)}\nOutput: ${formatNumber(p.outputTokens)}`}
                  >
                    {formatNumber(noCache)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-textSecondary">
                    <span className="text-green-500">{cacheHitPct}%</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{p.activeDays}</td>
                  <td className="p-3 text-right text-textSecondary">{p.lastDate.slice(0, 10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
