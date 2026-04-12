#!/usr/bin/env node
// scripts/install-hook.mjs
// One-shot: adds a Claude Code Stop hook that auto-runs collect-usage.mjs after
// every session. Safe to re-run — checks for an existing entry first.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_FILE = join(homedir(), '.claude', 'settings.json');
const SCRIPT_PATH = resolve(__dirname, 'collect-usage.mjs');
// Redirect stdout/stderr to a log file so the hook never interferes with sessions.
const COMMAND = `node "${SCRIPT_PATH}" >> /tmp/claude-usage-collect.log 2>&1`;

const settings = existsSync(SETTINGS_FILE)
  ? JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'))
  : {};

if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.Stop) settings.hooks.Stop = [];

// Avoid duplicate entries on repeated runs
const alreadyInstalled = settings.hooks.Stop.some(
  (group) =>
    Array.isArray(group.hooks) &&
    group.hooks.some((h) => typeof h.command === 'string' && h.command.includes('collect-usage'))
);

if (alreadyInstalled) {
  console.log('[install-hook] Stop hook already installed. Nothing changed.');
  process.exit(0);
}

settings.hooks.Stop.push({
  matcher: '',
  hooks: [{ type: 'command', command: COMMAND }],
});

writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n');
console.log('[install-hook] Stop hook installed:');
console.log(' ', COMMAND);
