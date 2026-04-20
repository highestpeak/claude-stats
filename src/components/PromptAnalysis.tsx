"use client";
import { useMemo, useState, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { topWords, CHART_TOOLTIP_STYLE } from "@/lib/utils";
import type { PromptEntry } from "@/lib/types";

const EXCLUDED_WORDS_KEY = "claude-stats-excluded-words";

export default function PromptAnalysis({ prompts }: { prompts: PromptEntry[] }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [showModal, setShowModal] = useState(false);
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

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis('');
    setShowModal(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topWords: filteredWords.map(w => w.word),
          userPrompt: userPrompt.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnalysis(text);
      }
      if (!text.trim()) setAnalysis(null);
    } catch (e) {
      setAnalysis('Analysis failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setAnalyzing(false);
    }
  };

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
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="分析引导（可选）：例如 &quot;哪些 prompt 模式应该写入 CLAUDE.md&quot;"
          className="w-full mt-4 px-3 py-2 rounded bg-bg border border-border text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-blue-500 resize-none"
          rows={2}
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50 transition-colors"
          >
            {analyzing ? 'Analyzing...' : 'AI Analysis'}
          </button>
          {analysis !== null && !analyzing && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-2 rounded border border-border text-textSecondary hover:text-textPrimary text-sm transition-colors"
              title="View last analysis"
            >View</button>
          )}
        </div>
      </div>

      {/* Analysis Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget && !analyzing) setShowModal(false); }}
        >
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-textPrimary font-semibold">AI Analysis</h3>
              {!analyzing && (
                <button
                  onClick={() => setShowModal(false)}
                  className="text-textSecondary hover:text-textPrimary text-lg leading-none"
                >&times;</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="text-sm text-textPrimary whitespace-pre-wrap leading-relaxed">
                {analysis || (analyzing ? '' : '')}
                {analyzing && <span className="inline-block w-1.5 h-4 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />}
              </div>
            </div>
            {!analyzing && (
              <div className="px-6 py-3 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-1.5 rounded text-sm text-textSecondary hover:text-textPrimary border border-border hover:border-textSecondary transition-colors"
                >Close</button>
              </div>
            )}
          </div>
        </div>
      )}

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
