import { spawn } from 'child_process';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { topWords, userPrompt, project, from, to } = await req.json();

    const db = getDb();

    // Fetch recent prompts
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

    const topWordsStr = (topWords || []).join(', ');

    // Use stream-json format for real-time streaming
    // --bare skips hooks/plugins for faster startup
    // --model sonnet for speed
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let fullText = '';
        let buffer = '';

        const proc = spawn('claude', [
          '-p',
          '--output-format', 'stream-json',
          '--verbose',
          '--bare',
          '--model', 'sonnet',
          analysisPrompt,
        ], {
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timeout = setTimeout(() => {
          proc.kill();
          controller.close();
        }, 120000);

        proc.stdout.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);
              // Extract text from assistant messages
              if (event.type === 'assistant' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && block.text) {
                    // Only send new text (delta)
                    const newText = block.text.slice(fullText.length);
                    if (newText) {
                      fullText = block.text;
                      controller.enqueue(encoder.encode(newText));
                    }
                  }
                }
              }
              // Also check for final result
              if (event.type === 'result' && event.result) {
                const remaining = event.result.slice(fullText.length);
                if (remaining) {
                  fullText = event.result;
                  controller.enqueue(encoder.encode(remaining));
                }
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        });

        proc.on('close', () => {
          clearTimeout(timeout);
          // Persist the analysis result
          if (fullText.trim()) {
            try {
              db.prepare(
                `INSERT INTO analyses (created_at, user_prompt, top_words, result, project_filter, prompt_count)
                 VALUES (?, ?, ?, ?, ?, ?)`
              ).run(
                new Date().toISOString(),
                userPrompt || null,
                topWordsStr || null,
                fullText,
                project || null,
                prompts.length,
              );
            } catch {
              // Don't fail the response if persistence fails
            }
          }
          controller.close();
        });

        proc.on('error', (err) => {
          clearTimeout(timeout);
          controller.enqueue(encoder.encode(`\n[Error: ${err.message}]`));
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

/** GET: retrieve past analyses */
export async function GET(req: Request) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') ?? 10)));
  const offset = (page - 1) * pageSize;

  const total = (db.prepare('SELECT COUNT(*) as count FROM analyses').get() as { count: number }).count;
  const data = db.prepare(
    'SELECT id, created_at, user_prompt, top_words, result, project_filter, prompt_count FROM analyses ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(pageSize, offset);

  return Response.json({
    data,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}
