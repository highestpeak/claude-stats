import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { WindowTimelineRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const windowId = Number(id);
    if (Number.isNaN(windowId)) {
      return NextResponse.json({ error: "Invalid window id" }, { status: 400 });
    }

    const db = getDb();

    // Verify window exists
    const window = db.prepare("SELECT id FROM usage_windows WHERE id = ?").get(windowId);
    if (!window) {
      return NextResponse.json({ error: "Window not found" }, { status: 404 });
    }

    const rows = db
      .prepare(
        `SELECT id, window_id, timestamp, minutes_from_start, tokens, cumulative_tokens
         FROM window_timeline
         WHERE window_id = ?
         ORDER BY minutes_from_start`
      )
      .all(windowId) as WindowTimelineRow[];

    return NextResponse.json(rows);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
