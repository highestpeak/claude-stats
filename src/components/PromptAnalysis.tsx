"use client";
import { useMemo, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { topWords, CHART_TOOLTIP_STYLE } from "@/lib/utils";
import type { PromptEntry } from "@/lib/types";

const EXCLUDED_WORDS_KEY = "claude-stats-excluded-words";

export default function PromptAnalysis({ prompts }: { prompts: PromptEntry[] }) {
  const [excludedWords, setExcludedWords] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(EXCLUDED_WORDS_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const words = useMemo(() => topWords(prompts.map((p) => p.content), 15 + excludedWords.size), [prompts, excludedWords.size]);
  const filteredWords = useMemo(() => words.filter((w) => !excludedWords.has(w.word)).slice(0, 15), [words, excludedWords]);

  const removeWord = useCallback((word: string) => {
    setExcludedWords((prev) => {
      const next = new Set(prev);
      next.add(word);
      localStorage.setItem(EXCLUDED_WORDS_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const resetExcluded = useCallback(() => {
    setExcludedWords(new Set());
    localStorage.removeItem(EXCLUDED_WORDS_KEY);
  }, []);

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
          {filteredWords.map(({ word, count }) => (
            <div key={word} className="flex items-center gap-2 text-sm">
              <span className="text-textPrimary w-28 truncate">{word}</span>
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${(count / (filteredWords[0]?.count ?? 1)) * 100}%` }}
                />
              </div>
              <span className="text-textSecondary text-xs w-8 text-right tabular-nums">{count}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeWord(word); }}
                className="text-textSecondary hover:text-red-400 ml-1 text-xs"
                title="Exclude from analysis"
              >&times;</button>
            </div>
          ))}
          {filteredWords.length === 0 && (
            <p className="text-textSecondary text-sm">No data</p>
          )}
        </div>
        {excludedWords.size > 0 && (
          <button
            onClick={resetExcluded}
            className="text-xs text-blue-400 hover:text-blue-300 mt-2"
          >Reset excluded ({excludedWords.size})</button>
        )}
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
