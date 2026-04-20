import { NextRequest, NextResponse } from "next/server";
import { getDb, paginate } from "@/lib/db";
import type { UsageWindowRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.max(1, Math.min(100, Number(searchParams.get("pageSize") ?? 20)));

    // Paginated usage windows
    const dataQuery = `
      SELECT id, start_time, end_time, window_close_time,
             request_count, input_tokens, output_tokens,
             cache_read_tokens, cache_creation_tokens, total_tokens,
             active_duration_sec, active_periods, peak_minute_tokens
      FROM usage_windows
      ORDER BY start_time DESC
      LIMIT :limit OFFSET :offset
    `;
    const countQuery = `SELECT COUNT(*) as count FROM usage_windows`;

    const windows = paginate<UsageWindowRow>(db, dataQuery, countQuery, {}, page, pageSize);

    // Hourly aggregates from usage_windows
    const hourlyAggregates = db
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H:00:00.000Z', start_time) as hour,
                SUM(total_tokens) as tokens,
                SUM(request_count) as requests
         FROM usage_windows
         GROUP BY hour
         ORDER BY hour`
      )
      .all() as { hour: string; tokens: number; requests: number }[];

    // Weekly aggregates from usage_windows (week starts Monday)
    const weeklyAggregates = db
      .prepare(
        `SELECT DATE(start_time, 'weekday 0', '-6 days') as weekStart,
                SUM(total_tokens) as tokens,
                SUM(request_count) as requests
         FROM usage_windows
         GROUP BY weekStart
         ORDER BY weekStart`
      )
      .all() as { weekStart: string; tokens: number; requests: number }[];

    // Average burndown pattern: normalized percentage at each 5-min bucket across all windows
    const avgPattern = db
      .prepare(
        `SELECT
           CAST(ROUND(wt.minutes_from_start / 5) * 5 AS INTEGER) as minute,
           AVG(CAST(wt.cumulative_tokens AS REAL) / uw.total_tokens) as avgPct
         FROM window_timeline wt
         JOIN usage_windows uw ON wt.window_id = uw.id
         WHERE uw.total_tokens > 0
         GROUP BY minute
         ORDER BY minute`
      )
      .all() as { minute: number; avgPct: number }[];

    return NextResponse.json({
      windows,
      hourlyAggregates,
      weeklyAggregates,
      averagePattern: avgPattern,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
