import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topWords, userPrompt, project, from, to } = await req.json();

    const db = getDb();

    // Fetch recent prompts (first 300 chars each, up to 80)
    let query = `SELECT content, timestamp, project_name FROM messages WHERE role='user' AND content IS NOT NULL`;
    const params: Record<string, string> = {};
    if (project) { query += ` AND project_id = :project`; params.project = project; }
    if (from) { query += ` AND timestamp >= :from`; params.from = from; }
    if (to) { query += ` AND timestamp <= :to`; params.to = to; }
    query += ` ORDER BY timestamp DESC LIMIT 80`;

    const prompts = db.prepare(query).all(params) as Array<{ content: string; timestamp: string; project_name: string }>;
    const summaries = prompts.map(p =>
      `[${p.timestamp.slice(0, 16)}] [${p.project_name}] ${p.content.slice(0, 300)}`
    ).join('\n');

    // Build the analysis prompt
    const defaultInstruction = `请分析：
1. 使用模式和习惯（什么类型的任务最多）
2. 效率建议（哪些重复性任务可以优化）
3. 有趣的发现

用中文回答，简洁明了，每点 2-3 句话。`;

    const analysisPrompt = `分析以下 Claude Code 使用数据：

高频关键词: ${(topWords || []).join(', ')}

最近 ${prompts.length} 条 prompts:
${summaries}

${userPrompt ? `用户的分析需求: ${userPrompt}` : defaultInstruction}`;

    // Call local claude CLI with -p flag (non-interactive, print mode)
    const result = await new Promise<string>((resolve, reject) => {
      const proc = execFile('claude', ['-p', analysisPrompt], {
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env },
      }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message));
        } else {
          resolve(stdout.trim());
        }
      });
      // Safety: kill if somehow still running
      setTimeout(() => proc.kill(), 125000);
    });

    return NextResponse.json({ analysis: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
