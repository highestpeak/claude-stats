import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { topWords, project, from, to } = await req.json();

    const db = getDb();

    // Fetch recent prompt summaries (first 200 chars each, up to 50)
    let query = `SELECT content, timestamp, project_name FROM messages WHERE role='user' AND content IS NOT NULL`;
    const params: Record<string, string> = {};
    if (project) { query += ` AND project_id = :project`; params.project = project; }
    if (from) { query += ` AND timestamp >= :from`; params.from = from; }
    if (to) { query += ` AND timestamp <= :to`; params.to = to; }
    query += ` ORDER BY timestamp DESC LIMIT 50`;

    const prompts = db.prepare(query).all(params) as Array<{ content: string; timestamp: string; project_name: string }>;
    const summaries = prompts.map(p => `[${p.timestamp.slice(0, 16)}] ${p.content.slice(0, 200)}`).join('\n');

    const client = new Anthropic();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `分析以下 Claude Code 使用模式：

高频关键词: ${(topWords || []).join(', ')}

最近 prompts 摘要:
${summaries}

请分析：
1. 使用模式和习惯（什么类型的任务最多）
2. 效率建议（哪些重复性任务可以优化）
3. 有趣的发现

用中文回答，简洁明了，每点 2-3 句话。`
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ analysis: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
