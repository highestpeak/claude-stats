"use client";
import { useEffect, useState } from "react";
import ProjectChart from "@/components/ProjectChart";
import ProjectTable from "@/components/ProjectTable";
import { formatNumber } from "@/lib/utils";
import type { ProjectStats } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        setProjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-textSecondary">Loading projects...</p>
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

  const totalMessages = projects.reduce((s, p) => s + p.messageCount, 0);
  const mostActive    = projects[0];

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Projects</p>
          <p className="text-3xl font-bold mt-1">{projects.length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Most Active</p>
          <p className="text-xl font-bold mt-1 truncate" title={mostActive?.displayName}>
            {mostActive?.displayName ?? "—"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="text-textSecondary text-sm">Total Messages</p>
          <p className="text-3xl font-bold mt-1">{formatNumber(totalMessages)}</p>
        </div>
      </div>

      <div className="space-y-6">
        <ProjectChart projects={projects.slice(0, 10)} />
        <ProjectTable projects={projects} />
      </div>
    </main>
  );
}
