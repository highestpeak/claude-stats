import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  const filePath = join(homedir(), '.claude', 'usage-windows-cache.json');

  if (!existsSync(filePath)) {
    return NextResponse.json(
      { error: 'Cache not found. Run: node scripts/collect-usage.mjs' },
      { status: 404 }
    );
  }

  try {
    const content = readFileSync(filePath, 'utf8');
    return NextResponse.json(JSON.parse(content));
  } catch {
    return NextResponse.json({ error: 'Failed to read cache file' }, { status: 500 });
  }
}
