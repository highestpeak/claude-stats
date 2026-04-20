import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

let collecting = false;

export async function POST() {
  if (collecting) {
    return NextResponse.json({ status: 'already_running' }, { status: 409 });
  }
  collecting = true;

  try {
    const scriptPath = path.resolve(process.cwd(), 'scripts/collect-to-db.mjs');
    await new Promise<void>((resolve, reject) => {
      execFile('node', [scriptPath], { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('collect error:', stderr);
          reject(err);
        } else {
          console.log('collect output:', stdout);
          resolve();
        }
      });
    });
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    return NextResponse.json({ status: 'error', message: String(e) }, { status: 500 });
  } finally {
    collecting = false;
  }
}
