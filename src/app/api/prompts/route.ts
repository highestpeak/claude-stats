import { NextRequest, NextResponse } from "next/server";
import { getDb, paginate } from "@/lib/db";
import type { PromptEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") ?? 20)));
    const project = searchParams.get("project") || null;
    const search = searchParams.get("search") || null;
    const from = searchParams.get("from") || null;
    const to = searchParams.get("to") || null;

    const filters: string[] = ["role = 'user'", "content IS NOT NULL"];
    const params: Record<string, unknown> = {};

    if (project) {
      filters.push("project_id = :project");
      params.project = project;
    }
    if (search) {
      filters.push("content LIKE '%' || :search || '%'");
      params.search = search;
    }
    if (from) {
      filters.push("timestamp >= :from");
      params.from = from;
    }
    if (to) {
      filters.push("timestamp <= :to");
      params.to = to;
    }

    const whereClause = filters.join(" AND ");

    const dataQuery = `
      SELECT id, project_id as projectId, project_name as projectName,
             timestamp, content, 0 as inputTokens, 0 as outputTokens
      FROM messages
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE ${whereClause}
    `;

    const result = paginate<PromptEntry>(db, dataQuery, countQuery, params, page, pageSize);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
