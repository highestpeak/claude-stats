import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    const rows = db
      .prepare(
        `SELECT model,
                SUM(input_tokens) as inputTokens,
                SUM(output_tokens) as outputTokens,
                SUM(cache_read_tokens) as cacheReadInputTokens,
                SUM(cache_creation_tokens) as cacheCreationInputTokens,
                SUM(cost_usd) as costUSD
         FROM messages
         WHERE role='assistant' AND model IS NOT NULL
         GROUP BY model`
      )
      .all() as {
      model: string;
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      costUSD: number;
    }[];

    const modelUsage: Record<string, { inputTokens: number; outputTokens: number; cacheReadInputTokens: number; cacheCreationInputTokens: number; costUSD: number }> = {};
    for (const row of rows) {
      modelUsage[row.model] = {
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        cacheReadInputTokens: row.cacheReadInputTokens,
        cacheCreationInputTokens: row.cacheCreationInputTokens,
        costUSD: row.costUSD,
      };
    }

    return NextResponse.json({ modelUsage });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
