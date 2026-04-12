import { describe, it, expect } from 'vitest';
import { calcStreaks, decodeProjectName, topWords, calcCacheSavings, formatNumber, groupIntoWindows } from './utils';

describe('calcStreaks', () => {
  it('returns zeros for empty input', () => {
    expect(calcStreaks([])).toEqual({ current: 0, longest: 0 });
  });
  it('counts 3 consecutive days', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-02', '2025-01-03']);
    expect(longest).toBe(3);
  });
  it('resets on a one-day gap', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-03']);
    expect(longest).toBe(1);
  });
  it('deduplicates same-day entries', () => {
    const { longest } = calcStreaks(['2025-01-01', '2025-01-01', '2025-01-02']);
    expect(longest).toBe(2);
  });
  it('current streak is 0 when last date is older than yesterday', () => {
    const { current } = calcStreaks(['2020-01-01', '2020-01-02']);
    expect(current).toBe(0);
  });
});

describe('decodeProjectName', () => {
  it('strips home dir prefix', () => {
    expect(decodeProjectName('-Users-alice-code-myproj', '/Users/alice')).toBe('code-myproj');
  });
  it('strips leading dash when no home match', () => {
    expect(decodeProjectName('-foo-bar', '/Users/alice')).toBe('foo-bar');
  });
  it('returns original when stripping home leaves empty string', () => {
    expect(decodeProjectName('-Users-alice', '/Users/alice')).toBe('-Users-alice');
  });
});

describe('topWords', () => {
  it('returns top N words by frequency', () => {
    const result = topWords(['hello world hello', 'hello'], 2);
    expect(result[0]).toEqual({ word: 'hello', count: 3 });
    expect(result[1]).toEqual({ word: 'world', count: 1 });
  });
  it('filters English stop words', () => {
    const result = topWords(['the quick brown fox'], 10);
    const words = result.map((r) => r.word);
    expect(words).not.toContain('the');
  });
  it('handles empty input', () => {
    expect(topWords([], 5)).toEqual([]);
  });
});

describe('formatNumber', () => {
  it('formats millions', () => {
    expect(formatNumber(1_500_000)).toBe('1.5M');
  });
  it('formats K without bleeding into M range', () => {
    expect(formatNumber(999_949)).toBe('999.9K');
  });
  it('formats the 999,950 boundary as M', () => {
    expect(formatNumber(999_999)).toBe('1.0M');
  });
  it('formats small numbers', () => {
    expect(formatNumber(500)).toBe('500');
  });
});

describe('calcCacheSavings', () => {
  it('computes savings for claude-sonnet-4-6', () => {
    // $3/M input, $0.30/M cache read → savings = $2.70 per 1M tokens
    const savings = calcCacheSavings({
      'claude-sonnet-4-6': { cacheReadInputTokens: 1_000_000 },
    });
    expect(savings).toBeCloseTo(2.7);
  });
  it('returns 0 for unknown model', () => {
    expect(calcCacheSavings({ 'unknown-model': { cacheReadInputTokens: 1_000_000 } })).toBe(0);
  });
});

const msg = (timestamp: string, tokens = 100) => ({
  timestamp,
  inputTokens: tokens,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
});

describe('groupIntoWindows', () => {
  it('returns empty array for empty input', () => {
    expect(groupIntoWindows([])).toEqual([]);
  });

  it('puts all messages within 5h into one window', () => {
    const result = groupIntoWindows([
      msg('2026-01-01T00:00:00Z', 100),
      msg('2026-01-01T04:59:59Z', 200),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].requestCount).toBe(2);
    expect(result[0].totalTokens).toBe(300);
  });

  it('splits into two windows when gap is exactly 5h', () => {
    const result = groupIntoWindows([
      msg('2026-01-01T00:00:00Z', 100),
      msg('2026-01-01T05:00:00Z', 200),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].totalTokens).toBe(100);
    expect(result[1].totalTokens).toBe(200);
  });

  it('sorts messages before grouping (order-independent input)', () => {
    const result = groupIntoWindows([
      msg('2026-01-01T04:00:00Z', 200),
      msg('2026-01-01T00:00:00Z', 100),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('2026-01-01T00:00:00.000Z');
    expect(result[0].timeline[0].cumulativeTokens).toBe(100);
    expect(result[0].timeline[1].cumulativeTokens).toBe(300);
  });

  it('sets window endTime to startTime + 5h', () => {
    const result = groupIntoWindows([msg('2026-01-01T10:00:00Z')]);
    expect(result[0].endTime).toBe('2026-01-01T15:00:00.000Z');
  });

  it('computes minutesFromStart correctly', () => {
    const result = groupIntoWindows([
      msg('2026-01-01T00:00:00Z'),
      msg('2026-01-01T01:30:00Z'),
    ]);
    expect(result[0].timeline[0].minutesFromStart).toBe(0);
    expect(result[0].timeline[1].minutesFromStart).toBe(90);
  });

  it('sums all token types into totalTokens', () => {
    const result = groupIntoWindows([{
      timestamp: '2026-01-01T00:00:00Z',
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 30,
      cacheCreationTokens: 40,
    }]);
    expect(result[0].totalTokens).toBe(100);
    expect(result[0].inputTokens).toBe(10);
    expect(result[0].outputTokens).toBe(20);
    expect(result[0].cacheReadTokens).toBe(30);
    expect(result[0].cacheCreationTokens).toBe(40);
  });
});
