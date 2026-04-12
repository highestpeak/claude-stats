import type { UsageWindow, WindowTimelinePoint } from './types';

// Token prices in USD per 1M tokens
export const TOKEN_PRICES: Record<string, {
  input: number; output: number; cacheRead: number; cacheCreation: number;
}> = {
  'claude-opus-4-6':           { input: 15,   output: 75,  cacheRead: 1.5,  cacheCreation: 18.75 },
  'claude-sonnet-4-6':         { input: 3,    output: 15,  cacheRead: 0.3,  cacheCreation: 3.75  },
  'claude-haiku-4-5-20251001': { input: 0.8,  output: 4,   cacheRead: 0.08, cacheCreation: 1.0   },
};

/** Decode project directory name to a human-readable path string.
 *  e.g. '-Users-alice-code-myproj' + '/Users/alice' → 'code-myproj'
 */
export function decodeProjectName(dirName: string, homeDir: string): string {
  const encodedHome = homeDir.replace(/\//g, '-'); // '/Users/alice' → '-Users-alice'
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, '');
    return rest || dirName; // fallback to original if nothing remains
  }
  return dirName.replace(/^-/, '');
}

/** Calculate current and longest active-day streaks from an array of date strings (YYYY-MM-DD). */
export function calcStreaks(dates: string[]): { current: number; longest: number } {
  if (dates.length === 0) return { current: 0, longest: 0 };
  const sorted = Array.from(new Set(dates)).sort();
  let longest = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diff =
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000;
    if (diff === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current streak: only counts if last active date is today or yesterday
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const lastDate = sorted[sorted.length - 1];
  let current = 0;
  if (lastDate === today || lastDate === yesterday) {
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      const diff =
        (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000;
      if (diff === 1) current++;
      else break;
    }
  }

  return { current, longest };
}

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','could','should','may','might','can','not',
  'in','on','at','to','for','of','and','or','but','if','with','this','that',
  'it','its','i','you','we','they','me','my','your','our','their','what','how',
  'when','where','why','which','who','so','by','from','into','just','also',
  '的','了','是','在','我','你','他','她','们','个','有','不','好','就','也',
  '一','这','那','和','与','或','但','因','为','把','么','呢','啊','吧',
]);

/** Return top N words by frequency across all texts, filtering stop words. */
export function topWords(texts: string[], n: number): Array<{ word: string; count: number }> {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    const tokens = text.toLowerCase().match(/[\u4e00-\u9fa5]+|[a-z]{3,}/g) ?? [];
    for (const w of tokens) {
      if (!STOP_WORDS.has(w)) freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Estimate USD saved by cache reads vs paying full input price. */
export function calcCacheSavings(
  modelUsage: Record<string, { cacheReadInputTokens: number }>
): number {
  let total = 0;
  for (const [model, usage] of Object.entries(modelUsage)) {
    const prices = TOKEN_PRICES[model];
    if (!prices) continue;
    total += (usage.cacheReadInputTokens / 1_000_000) * (prices.input - prices.cacheRead);
  }
  return total;
}

export function formatNumber(n: number): string {
  if (n >= 999_950) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export function formatCurrency(usd: number): string {
  return '$' + usd.toFixed(2);
}

export interface RawUsageMessage {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

function buildUsageWindow(messages: RawUsageMessage[], windowStart: Date): UsageWindow {
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  let cumulative = 0;

  const timeline: WindowTimelinePoint[] = messages.map((msg) => {
    const tokens =
      msg.inputTokens + msg.outputTokens + msg.cacheReadTokens + msg.cacheCreationTokens;
    inputTokens += msg.inputTokens;
    outputTokens += msg.outputTokens;
    cacheReadTokens += msg.cacheReadTokens;
    cacheCreationTokens += msg.cacheCreationTokens;
    cumulative += tokens;
    return {
      timestamp: msg.timestamp,
      minutesFromStart: Math.round(
        (new Date(msg.timestamp).getTime() - windowStart.getTime()) / 60_000
      ),
      tokens,
      cumulativeTokens: cumulative,
    };
  });

  return {
    id: windowStart.toISOString(),
    startTime: windowStart.toISOString(),
    endTime: new Date(windowStart.getTime() + FIVE_HOURS_MS).toISOString(),
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
    requestCount: messages.length,
    timeline,
  };
}

export function groupIntoWindows(messages: RawUsageMessage[]): UsageWindow[] {
  if (messages.length === 0) return [];
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const windows: UsageWindow[] = [];
  let windowStart = new Date(sorted[0].timestamp);
  let bucket: RawUsageMessage[] = [];

  for (const msg of sorted) {
    const t = new Date(msg.timestamp).getTime();
    if (t - windowStart.getTime() >= FIVE_HOURS_MS) {
      windows.push(buildUsageWindow(bucket, windowStart));
      windowStart = new Date(msg.timestamp);
      bucket = [];
    }
    bucket.push(msg);
  }

  if (bucket.length > 0) {
    windows.push(buildUsageWindow(bucket, windowStart));
  }

  return windows;
}
