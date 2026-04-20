"use client";
import { useEffect, useState } from "react";
import ProjectChart from "@/components/ProjectChart";
import ProjectTable from "@/components/ProjectTable";
import { formatNumber } from "@/lib/utils";
import type { ProjectStats, PaginationInfo } from "@/lib/types";
import ExportButton from "@/components/ExportButton";

const PAGE_SIZE = 20;

export default function ProjectsPage() {
  const [projects, setProjects]       = useState<ProjectStats[]>([]);
  const [pagination, setPagination]   = useState<PaginationInfo | null>(null);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    fetch(`/api/projects?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        setProjects(data.data || []);
        setPagination(data.pagination || null);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [page]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const totalMessages = projects.reduce((s, p) => s + p.messageCount, 0);
  const mostActive    = projects.length > 0 && page === 1 ? projects[0] : null;

  return (
    <main id="export-projects" className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <ExportButton targetId="export-projects" filename={`claude-stats-projects-${new Date().toISOString().slice(0,10)}.png`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Projects</p>
          <p className="text-3xl font-bold mt-1">{pagination?.total ?? projects.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Most Active</p>
          <p className="text-xl font-bold mt-1 truncate" title={mostActive?.displayName}>
            {mostActive?.displayName ?? "—"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Messages (this page)</p>
          <p className="text-3xl font-bold mt-1">{formatNumber(totalMessages)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Top 10 chart only shown on first page */}
        {page === 1 && <ProjectChart projects={projects.slice(0, 10)} />}

        {loading ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-textSecondary">Loading projects...</p>
          </div>
        ) : (
          <>
            <ProjectTable projects={projects} />
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
    </main>
  );
}
