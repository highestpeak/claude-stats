"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import PromptList from "@/components/PromptList";
import PromptAnalysis from "@/components/PromptAnalysis";
import type { PromptEntry, PaginationInfo } from "@/lib/types";
import ExportButton from "@/components/ExportButton";

const PAGE_SIZE = 50;

export default function PromptsPage() {
  const [prompts, setPrompts]             = useState<PromptEntry[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [page, setPage]                   = useState(1);
  const [pagination, setPagination]       = useState<PaginationInfo | null>(null);
  const [projects, setProjects]           = useState<{ id: string; name: string }[]>([]);

  // Debounce search input
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, projectFilter]);

  // Fetch projects for dropdown (once)
  useEffect(() => {
    fetch("/api/projects?pageSize=100")
      .then((r) => r.json())
      .then((data) => {
        const list = (data.data || []) as { id: string; displayName: string }[];
        setProjects(list.map((p) => ({ id: p.id, name: p.displayName })));
      })
      .catch(() => {});
  }, []);

  // Fetch prompts with server-side pagination + filters
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (projectFilter) params.set("project", projectFilter);

    fetch(`/api/prompts?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load prompts");
        return r.json();
      })
      .then((data) => {
        setPrompts(data.data || []);
        setPagination(data.pagination || null);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [page, debouncedSearch, projectFilter]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <main id="export-prompts" className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Prompt History</h1>
        <ExportButton targetId="export-prompts" filename={`claude-stats-prompts-${new Date().toISOString().slice(0,10)}.png`} />
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-textPrimary placeholder-textSecondary focus:outline-none focus:border-blue-500 flex-1 min-w-48"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
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
          {loading ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <p className="text-textSecondary">Loading prompts...</p>
            </div>
          ) : (
            <>
              <PromptList prompts={prompts} total={pagination?.total} />
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm rounded border border-border text-textSecondary hover:text-textPrimary disabled:opacity-30"
                  >Prev</button>
                  <span className="text-sm text-textSecondary">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total.toLocaleString()} total)
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-sm rounded border border-border text-textSecondary hover:text-textPrimary disabled:opacity-30"
                  >Next</button>
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <PromptAnalysis prompts={prompts} />
        </div>
      </div>
    </main>
  );
}
