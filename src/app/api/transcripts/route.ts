import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const dynamic = "force-dynamic";

interface TranscriptLine {
  type: string;
  timestamp: string;
  content?: string;
}

export async function GET() {
  try {
    const transcriptsDir = path.join(os.homedir(), ".claude", "transcripts");
    if (!fs.existsSync(transcriptsDir)) {
      return NextResponse.json({ totalMessages: 0, messagesByDate: {}, sessions: [] });
    }

    const files = fs.readdirSync(transcriptsDir).filter((f) => f.endsWith(".jsonl"));
    let totalMessages = 0;
    const messagesByDate: Record<string, number> = {};
    const sessions: { file: string; start: string; end: string; messageCount: number }[] = [];

    for (const file of files) {
      const filePath = path.join(transcriptsDir, file);
      const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
      let firstTs = "";
      let lastTs = "";
      let count = 0;

      for (const line of lines) {
        try {
          const msg: TranscriptLine = JSON.parse(line);
          if (msg.timestamp) {
            if (!firstTs) firstTs = msg.timestamp;
            lastTs = msg.timestamp;
            const date = msg.timestamp.slice(0, 10);
            messagesByDate[date] = (messagesByDate[date] || 0) + 1;
          }
          count++;
        } catch {
          // skip malformed lines
        }
      }

      totalMessages += count;
      if (firstTs && lastTs) {
        sessions.push({ file, start: firstTs, end: lastTs, messageCount: count });
      }
    }

    return NextResponse.json({ totalMessages, messagesByDate, sessions });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
