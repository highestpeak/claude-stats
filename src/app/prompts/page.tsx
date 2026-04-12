"use client";
import { useEffect, useState, useMemo } from "react";
import PromptList from "@/components/PromptList";
import PromptAnalysis from "@/components/PromptAnalysis";
import type { PromptEntry } from "@/lib/types";

export default function PromptsPage() {
  const [prompts, setPrompts]             = useState<PromptEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  useEffect(() => {
    fetch("/api/prompts")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load prompts");
        return r.json();
      })
      .then((data) => {
        setPrompts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const projects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of prompts) {
      if (!seen.has(p.projectId)) seen.set(p.projectId, p.projectName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [prompts]);

  const filtered = useMemo(
    () =>
      prompts.filter((p) => {
        if (projectFilter && p.projectId !== projectFilter) return false;
        if (search && !p.content.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [prompts, search, projectFilter]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading prompts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Prompt History</h1>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-blue-500 flex-1 min-w-48"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-textPrimary focus:outline-none focus:border-blue-500"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PromptList prompts={filtered} />
        </div>
        <div>
          <PromptAnalysis prompts={prompts} />
        </div>
      </div>
    </main>
  );
}
