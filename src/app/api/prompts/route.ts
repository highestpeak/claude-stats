import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import type { PromptEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, "-");
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, "");
    return rest || dirName;
  }
  return dirName.replace(/^-/, "");
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type?: string; text?: string }>)
      .filter((c) => c?.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string)
      .join("\n");
  }
  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project") ?? "";
  const search    = (searchParams.get("search") ?? "").toLowerCase();
  const from      = searchParams.get("from") ?? "";
  const to        = searchParams.get("to")   ?? "";

  try {
    const projectsDir = path.join(os.homedir(), ".claude", "projects");
    if (!fs.existsSync(projectsDir)) return NextResponse.json([]);

    const homeDir  = os.homedir();
    const prompts: PromptEntry[] = [];

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .filter((e) => !projectId || e.name === projectId);

    for (const entry of entries) {
      const projectDir  = path.join(projectsDir, entry.name);
      const projectName = decodeProjectName(entry.name, homeDir);
      const jsonlFiles  = fs.readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        const lines = fs.readFileSync(path.join(projectDir, file), "utf-8")
          .split("\n")
          .filter(Boolean);

        let pendingPrompt: PromptEntry | null = null;

        for (const line of lines) {
          try {
            const msg = JSON.parse(line) as Record<string, unknown>;

            if (msg.type === "user" && !msg.toolUseResult && !msg.isMeta) {
              const content = extractText((msg.message as Record<string, unknown>)?.content);
              if (!content.trim()) continue;

              const ts   = (msg.timestamp as string | undefined) ?? "";
              const date = ts.slice(0, 10);

              if ((from && date < from) || (to && date > to)) continue;
              if (search && !content.toLowerCase().includes(search)) continue;

              pendingPrompt = {
                id:          `${entry.name}:${file}:${ts}`,
                projectId:   entry.name,
                projectName,
                timestamp:   ts,
                content,
                inputTokens:  0,
                outputTokens: 0,
              };
              prompts.push(pendingPrompt);
            } else if (msg.type === "assistant" && pendingPrompt) {
              const message = msg.message as Record<string, unknown> | undefined;
              const usage   = message?.usage as Record<string, number> | undefined;
              if (usage) {
                pendingPrompt.inputTokens  = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
                pendingPrompt.outputTokens = usage.output_tokens ?? 0;
              }
              pendingPrompt = null;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    prompts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return NextResponse.json(prompts);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
