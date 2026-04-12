import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const statsPath = path.join(os.homedir(), ".claude", "stats-cache.json");
    if (!fs.existsSync(statsPath)) {
      return NextResponse.json({ error: "stats-cache.json not found" }, { status: 404 });
    }
    const data = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
