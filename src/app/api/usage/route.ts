import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(os.homedir(), ".claude", "usage-windows-cache.json");

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Cache not found. Run: node scripts/collect-usage.mjs" },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    return NextResponse.json(JSON.parse(content));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
