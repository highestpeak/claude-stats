import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import type { ProjectStats } from "@/lib/types";

export const dynamic = "force-dynamic";

function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, "-");
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, "");
    return rest || dirName;
  }
  return dirName.replace(/^-/, "");
}

export async function GET() {
  try {
    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    if (!fs.existsSync(projectsDir)) return NextResponse.json([]);

    const homeDir = os.homedir();
    const results: ProjectStats[] = [];

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectDir = path.join(projectsDir, entry.name);
      const jsonlFiles = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

      let messageCount = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      const dates = new Set<string>();
      let firstDate = "";
      let lastDate = "";

      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file);
        const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as Record<string, unknown>;
            if (
              msg.type === "user" &&
              !msg.toolUseResult &&
              !msg.isMeta
            ) {
              messageCount++;
              const ts = msg.timestamp as string | undefined;
              if (ts) {
                const date = ts.slice(0, 10);
                dates.add(date);
                if (!firstDate || date < firstDate) firstDate = date;
                if (!lastDate || date > lastDate) lastDate = date;
              }
            }
            if (msg.type === "assistant") {
              const message = msg.message as Record<string, unknown> | undefined;
              const usage = message?.usage as Record<string, number> | undefined;
              if (usage) {
                inputTokens +=
                  (usage.input_tokens ?? 0) +
                  (usage.cache_read_input_tokens ?? 0) +
                  (usage.cache_creation_input_tokens ?? 0);
                outputTokens += usage.output_tokens ?? 0;
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (messageCount > 0) {
        results.push({
          id: entry.name,
          displayName: decodeProjectName(entry.name, homeDir),
          messageCount,
          inputTokens,
          outputTokens,
          firstDate,
          lastDate,
          activeDays: dates.size,
        });
      }
    }

    results.sort((a, b) => b.messageCount - a.messageCount);
    return NextResponse.json(results);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
