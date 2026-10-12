import { describe, expect, it } from 'vitest';
import { centsToMicros, costMicros } from './ai';

describe('AI cost', () => {
  it('prices Opus 5.5 at $4 in / $20 out per MTok in integer micro-dollars', () => {
    expect(costMicros('claude-opus-5-5', { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBe(
      4_000_000,
    );
    expect(costMicros('claude-opus-5-5', { input: 1000, output: 500, cacheRead: 0, cacheWrite: 0 })).toBe(
      4000 + 10_000,
    );
  });
  it('never under-counts an unknown model', () => {
    expect(
      costMicros('typo-model', { input: 1000, output: 1000, cacheRead: 0, cacheWrite: 0 }),
    ).toBeGreaterThan(
      costMicros('claude-opus-5-5', { input: 1000, output: 1000, cacheRead: 0, cacheWrite: 0 }),
    );
  });
  it('prices Sonnet 5.5 (the default) at $2 in / $10 out per MTok, half of Opus 5.5', () => {
    const u = { input: 1_000_000, output: 100_000, cacheRead: 0, cacheWrite: 0 };
    expect(costMicros('claude-sonnet-5-5', u)).toBe(3_000_000);
    expect(costMicros('claude-opus-5-5', u)).toBe(6_000_000);
  });
  it('converts cents to micros', () => expect(centsToMicros(100)).toBe(1_000_000));
});
