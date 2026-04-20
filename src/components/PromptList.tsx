"use client";
import { useState } from "react";
import type { PromptEntry } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

export default function PromptList({ prompts, total }: { prompts: PromptEntry[]; total?: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-3 border-b border-border text-textSecondary text-sm">
        {(total ?? prompts.length).toLocaleString()} prompts
      </div>
      <div className="divide-y divide-border max-h-[640px] overflow-y-auto">
        {prompts.map((p) => (
          <div
            key={p.id}
            className="p-4 hover:bg-bg cursor-pointer transition-colors"
            onClick={() => toggle(p.id)}
          >
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs text-textSecondary">
                {p.timestamp.slice(0, 16).replace("T", " ")}
              </span>
              <span className="text-xs bg-border rounded px-1.5 py-0.5 text-textSecondary truncate max-w-[180px]">
                {p.projectName}
              </span>
              {p.outputTokens > 0 && (
                <span className="text-xs text-textSecondary ml-auto">
                  {formatNumber(p.outputTokens)} out
                </span>
              )}
            </div>
            <p className="text-sm text-textPrimary whitespace-pre-wrap break-words">
              {expanded.has(p.id)
                ? p.content
                : p.content.slice(0, 160) + (p.content.length > 160 ? "…" : "")}
            </p>
          </div>
        ))}
        {prompts.length === 0 && (
          <div className="p-8 text-center text-textSecondary text-sm">No prompts found</div>
        )}
      </div>
    </div>
  );
}
