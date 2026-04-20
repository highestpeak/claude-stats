import { NextRequest, NextResponse } from "next/server";
import { getDb, paginate } from "@/lib/db";
import type { ProjectStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") ?? 20)));

    const dataQuery = `
      SELECT project_id as id, project_name as displayName,
        COUNT(CASE WHEN role='user' THEN 1 END) as messageCount,
        SUM(CASE WHEN role='assistant' THEN input_tokens ELSE 0 END) as inputTokens,
        SUM(CASE WHEN role='assistant' THEN output_tokens ELSE 0 END) as outputTokens,
        SUM(CASE WHEN role='assistant' THEN cache_read_tokens ELSE 0 END) as cacheReadTokens,
        SUM(CASE WHEN role='assistant' THEN cache_creation_tokens ELSE 0 END) as cacheCreationTokens,
        MIN(timestamp) as firstDate,
        MAX(timestamp) as lastDate,
        COUNT(DISTINCT DATE(timestamp)) as activeDays
      FROM messages
      GROUP BY project_id
      ORDER BY messageCount DESC
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM (
        SELECT project_id FROM messages GROUP BY project_id
      )
    `;

    const result = paginate<ProjectStats>(db, dataQuery, countQuery, {}, page, pageSize);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
