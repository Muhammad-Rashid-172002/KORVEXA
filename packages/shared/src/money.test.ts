import { describe, expect, it } from 'vitest';
import { DEFAULT_MILESTONE_TEMPLATE, quoteFees, splitByPercent } from './money';

describe('splitByPercent', () => {
  it('splits the default template exactly', () => {
    expect(splitByPercent(100_000, [30, 40, 30])).toEqual([30_000, 40_000, 30_000]);
  });

  it('always sums to the total, remainder goes to the last part', () => {
    expect(splitByPercent(1001, [30, 40, 30])).toEqual([300, 400, 301]);
    for (let total = 0; total < 3000; total += 7) {
      const parts = splitByPercent(
        total,
        DEFAULT_MILESTONE_TEMPLATE.map((m) => m.percent),
      );
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
    }
  });

  it('rejects invalid templates', () => {
    expect(() => splitByPercent(100, [50, 40])).toThrow();
    expect(() => splitByPercent(100, [])).toThrow();
    expect(() => splitByPercent(100, [100, 0])).toThrow();
    expect(() => splitByPercent(-1, [100])).toThrow();
    expect(() => splitByPercent(1.5, [100])).toThrow();
  });
});

describe('quoteFees', () => {
  const zero = { buyerServiceBps: 0, buyerServiceMin: 0, sellerCommissionBps: 0, sellerCommissionMin: 0 };

  it('is a no-op with the placeholder zero fees', () => {
    expect(quoteFees(50_000, zero)).toEqual({
      amount: 50_000,
      buyerFee: 0,
      buyerTotal: 50_000,
      sellerCommission: 0,
      sellerNet: 50_000,
    });
  });

  it('adds the buyer fee on top and deducts the seller commission', () => {
    const q = quoteFees(100_000, {
      buyerServiceBps: 500,
      buyerServiceMin: 0,
      sellerCommissionBps: 1000,
      sellerCommissionMin: 0,
    });
    expect(q).toEqual({
      amount: 100_000,
      buyerFee: 5_000,
      buyerTotal: 105_000,
      sellerCommission: 10_000,
      sellerNet: 90_000,
    });
  });

  it('applies minimums but never makes the seller net negative', () => {
    const q = quoteFees(300, {
      buyerServiceBps: 0,
      buyerServiceMin: 100,
      sellerCommissionBps: 0,
      sellerCommissionMin: 500,
    });
    expect(q.buyerFee).toBe(100);
    expect(q.sellerCommission).toBe(300);
    expect(q.sellerNet).toBe(0);
    expect(q.buyerTotal).toBe(400);
  });

  it('rounds half up in minor units', () => {
    const q = quoteFees(1_005, {
      buyerServiceBps: 100,
      buyerServiceMin: 0,
      sellerCommissionBps: 0,
      sellerCommissionMin: 0,
    });
    expect(q.buyerFee).toBe(10); // 10.05 → 10
    expect(quoteFees(1_050, { ...zero, buyerServiceBps: 100 }).buyerFee).toBe(11); // 10.5 → 11
  });
});
