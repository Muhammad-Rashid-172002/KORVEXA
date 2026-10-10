import { describe, expect, it } from 'vitest';
import { brand } from './brand';

describe('brand', () => {
  it('presents the product as "<product> by <parent>"', () => {
    expect(brand.lockup).toBe(`${brand.productName} by ${brand.parentName}`);
  });
});
