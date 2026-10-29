import { gigHelperResultSchema, serviceInputSchema } from '@glasswork/shared';
import { describe, expect, it } from 'vitest';
import { fallbackGigHelp } from './gig-helper.service';

const base = { categorySlug: 'mobile-apps', title: '', description: '' };

describe('fallbackGigHelp (offline helper)', () => {
  it('rewrites a plain title into an "I will" title', () => {
    const r = fallbackGigHelp({ ...base, kind: 'title', title: 'flutter app for my shop' });
    expect(r.title).toMatch(/^I will /);
    expect(r.title!.length).toBeGreaterThanOrEqual(30);
    expect(gigHelperResultSchema.safeParse(r).success).toBe(true);
  });
  it('keeps a good title and caps length at 100', () => {
    const r = fallbackGigHelp({ ...base, kind: 'title', title: `I will ${'build '.repeat(40)}` });
    expect(r.title!.length).toBeLessThanOrEqual(100);
  });
  it('suggests three valid packages', () => {
    const r = fallbackGigHelp({ ...base, kind: 'packages' });
    expect(r.packages.map((p) => p.tier)).toEqual(['basic', 'standard', 'premium']);
    expect(r.packages[0]!.price).toBeLessThan(r.packages[2]!.price);
    for (const p of r.packages)
      expect(
        serviceInputSchema.shape.packages.element.safeParse({
          tier: p.tier,
          title: p.title,
          description: p.description,
          priceAmount: p.price * 100,
          deliveryDays: p.days,
          revisions: p.revisions,
        }).success,
      ).toBe(true);
  });
  it('writes a guided description and FAQs', () => {
    expect(fallbackGigHelp({ ...base, kind: 'description', title: 'I will x' }).description).toContain(
      'What you get',
    );
    expect(fallbackGigHelp({ ...base, kind: 'faqs' }).faqs.length).toBeGreaterThan(0);
  });
});
