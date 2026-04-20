import { NextRequest, NextResponse } from "next/server";
import { getDb, getLastUpdated } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build optional date filter clause
    const dateFilters: string[] = [];
    const params: Record<string, unknown> = {};
    if (from) {
      dateFilters.push("timestamp >= :from");
      params.from = from;
    }
    if (to) {
      dateFilters.push("timestamp <= :to");
      params.to = to;
    }
    const whereDate = dateFilters.length > 0 ? " AND " + dateFilters.join(" AND ") : "";

    // totalSessions
    const totalSessions = (
      db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM messages WHERE 1=1${whereDate}`).get(params) as { c: number }
    ).c;

    // totalMessages
    const totalMessages = (
      db.prepare(`SELECT COUNT(*) as c FROM messages WHERE role='user'${whereDate}`).get(params) as { c: number }
    ).c;

    // hourCounts
    const hourRows = db
      .prepare(
        `SELECT CAST(strftime('%H', timestamp) AS INTEGER) as h, COUNT(*) as c FROM messages WHERE role='user'${whereDate} GROUP BY h`
      )
      .all(params) as { h: number; c: number }[];
    const hourCounts: Record<string, number> = {};
    for (const row of hourRows) {
      hourCounts[String(row.h)] = row.c;
    }

    // dailyActivity
    const dailyActivity = db
      .prepare(
        `SELECT DATE(timestamp) as date,
                COUNT(CASE WHEN role='user' THEN 1 END) as messageCount,
                COUNT(DISTINCT session_id) as sessionCount
         FROM messages WHERE 1=1${whereDate}
         GROUP BY date ORDER BY date`
      )
      .all(params) as { date: string; messageCount: number; sessionCount: number }[];
    const dailyActivityResult = dailyActivity.map((r) => ({
      date: r.date,
      messageCount: r.messageCount,
      sessionCount: r.sessionCount,
      toolCallCount: 0,
    }));

    // dailyModelTokens — pivot by date
    const dailyModelRows = db
      .prepare(
        `SELECT DATE(timestamp) as date, model,
                SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as tokens
         FROM messages
         WHERE role='assistant' AND model IS NOT NULL${whereDate}
         GROUP BY date, model ORDER BY date`
      )
      .all(params) as { date: string; model: string; tokens: number }[];
    const dailyModelMap = new Map<string, Record<string, number>>();
    for (const row of dailyModelRows) {
      if (!dailyModelMap.has(row.date)) dailyModelMap.set(row.date, {});
      dailyModelMap.get(row.date)![row.model] = row.tokens;
    }
    const dailyModelTokens = Array.from(dailyModelMap.entries()).map(([date, tokensByModel]) => ({
      date,
      tokensByModel,
    }));

    // modelUsage
    const modelRows = db
      .prepare(
        `SELECT model,
                SUM(input_tokens) as inputTokens,
                SUM(output_tokens) as outputTokens,
                SUM(cache_read_tokens) as cacheReadInputTokens,
                SUM(cache_creation_tokens) as cacheCreationInputTokens,
                SUM(cost_usd) as costUSD
         FROM messages
         WHERE role='assistant' AND model IS NOT NULL${whereDate}
         GROUP BY model`
      )
      .all(params) as {
      model: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }[];
    const modelUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUSD: number }> = {};
    for (const row of modelRows) {
      modelUsage[row.model] = {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadInputTokens: row.cacheReadInputTokens,
        cacheCreationInputTokens: row.cacheCreationInputTokens,
        costUSD: row.costUSD,
      };
    }

    // firstSessionDate
    const firstRow = db
      .prepare(`SELECT MIN(timestamp) as ts FROM messages WHERE 1=1${whereDate}`)
      .get(params) as { ts: string | null };
    const firstSessionDate = firstRow.ts ?? "";

    // lastUpdated
    const lastUpdated = getLastUpdated();
    const lastComputedDate = lastUpdated ?? new Date().toISOString();

    return NextResponse.json({
      totalSessions,
      totalMessages,
      hourCounts,
      dailyActivity: dailyActivityResult,
      dailyModelTokens,
      modelUsage,
      firstSessionDate,
      lastComputedDate,
      lastUpdated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
