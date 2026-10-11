import { describe, expect, it } from 'vitest';
import { computeFee } from './settings';

describe('computeFee', () => {
  it('uses integer basis points with half-up rounding', () => {
    expect(computeFee(10_000n, 500)).toBe(500n); // 5% of $100.00
    expect(computeFee(999n, 250)).toBe(25n); // 24.975 -> 25
  });
  it('applies the minimum', () => {
    expect(computeFee(100n, 500, 200n)).toBe(200n);
  });
  it('rejects bad input', () => {
    expect(() => computeFee(-1n, 100)).toThrow();
    expect(() => computeFee(1n, 10_001)).toThrow();
    expect(() => computeFee(1n, 1.5)).toThrow();
  });
});
