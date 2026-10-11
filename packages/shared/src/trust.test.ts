import { describe, expect, it } from 'vitest';
import { computeSellerLevel, nextLevelGap, SELLER_LEVELS, type SellerStats } from './trust';

const s = (over: Partial<SellerStats> = {}): SellerStats => ({
  completedProjects: 0,
  reviewCount: 0,
  avgRating: null,
  onTimeRate: null,
  ...over,
});

describe('seller levels (computed from real metrics only)', () => {
  it('everyone starts as a new seller, including those with no data at all', () => {
    expect(computeSellerLevel(s())).toBe('new');
    expect(computeSellerLevel(s({ completedProjects: 2, reviewCount: 2, avgRating: 5, onTimeRate: 1 }))).toBe(
      'new',
    );
  });

  it('needs every criterion: volume, review count, rating and on-time delivery', () => {
    const base = { completedProjects: 3, reviewCount: 3, avgRating: 4.2, onTimeRate: 0.85 };
    expect(computeSellerLevel(s(base))).toBe('level_1');
    expect(computeSellerLevel(s({ ...base, avgRating: 3.9 }))).toBe('new');
    expect(computeSellerLevel(s({ ...base, onTimeRate: 0.7 }))).toBe('new');
    expect(computeSellerLevel(s({ ...base, reviewCount: 2 }))).toBe('new');
    expect(computeSellerLevel(s({ ...base, avgRating: null }))).toBe('new');
  });

  it('picks the highest level met', () => {
    expect(
      computeSellerLevel(s({ completedProjects: 12, reviewCount: 9, avgRating: 4.6, onTimeRate: 0.92 })),
    ).toBe('level_2');
    expect(
      computeSellerLevel(s({ completedProjects: 30, reviewCount: 25, avgRating: 4.8, onTimeRate: 0.97 })),
    ).toBe('top_rated');
    // top volume but poor on-time falls back
    expect(
      computeSellerLevel(s({ completedProjects: 30, reviewCount: 25, avgRating: 4.8, onTimeRate: 0.85 })),
    ).toBe('level_1');
  });

  it('criteria are monotonic so a "minimum level" filter is well-defined', () => {
    for (let i = 1; i < SELLER_LEVELS.length; i++) {
      const lo = SELLER_LEVELS[i - 1]!.criteria;
      const hi = SELLER_LEVELS[i]!.criteria;
      expect(hi.completedProjects).toBeGreaterThanOrEqual(lo.completedProjects);
      expect(hi.reviewCount).toBeGreaterThanOrEqual(lo.reviewCount);
      expect(hi.avgRating).toBeGreaterThanOrEqual(lo.avgRating);
      expect(hi.onTimeRate).toBeGreaterThanOrEqual(lo.onTimeRate);
    }
  });

  it('explains what is missing for the next level, and nothing past the top', () => {
    const gap = nextLevelGap(s({ completedProjects: 1, reviewCount: 1, avgRating: 3.5, onTimeRate: 0.5 }))!;
    expect(gap.next).toBe('level_1');
    expect(gap.missing).toHaveLength(4);
    expect(
      nextLevelGap(s({ completedProjects: 99, reviewCount: 99, avgRating: 5, onTimeRate: 1 })),
    ).toBeNull();
  });
});
