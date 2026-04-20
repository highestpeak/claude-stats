"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { topWords, CHART_TOOLTIP_STYLE } from "@/lib/utils";
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
              contentStyle={CHART_TOOLTIP_STYLE.contentStyle}
              itemStyle={CHART_TOOLTIP_STYLE.itemStyle}
              labelStyle={CHART_TOOLTIP_STYLE.labelStyle}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-textSecondary text-xs mt-1">Short &lt;100 chars · Medium 100–500 · Long &gt;500</p>
      </div>
    </div>
  );
}
