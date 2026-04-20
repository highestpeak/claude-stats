import { spawn } from 'child_process';
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

    // Stream claude CLI stdout to the client
    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn('claude', ['-p', analysisPrompt], {
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timeout = setTimeout(() => {
          proc.kill();
          controller.close();
        }, 120000);

        proc.stdout.on('data', (chunk: Buffer) => {
          controller.enqueue(chunk);
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          // Ignore stderr progress indicators from claude CLI
          const text = chunk.toString();
          if (text.includes('Error') || text.includes('error')) {
            controller.enqueue(new TextEncoder().encode(`\n[Error: ${text.trim()}]`));
          }
        });

        proc.on('close', () => {
          clearTimeout(timeout);
          controller.close();
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          controller.enqueue(new TextEncoder().encode(`\n[Error: ${err.message}]`));
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
