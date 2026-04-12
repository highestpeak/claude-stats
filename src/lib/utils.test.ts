import { describe, it, expect } from 'vitest';
import { calcStreaks, decodeProjectName, topWords, calcCacheSavings, formatNumber } from './utils';

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
