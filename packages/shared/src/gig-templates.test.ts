import { describe, expect, it } from 'vitest';
import { GIG_TEMPLATES, gigQuality, gigTemplate, serviceInputSchema } from './index';

const full = {
  title: 'I will build a Flutter app for your business',
  categoryId: 'c',
  description: 'x'.repeat(320),
  packageCount: 3,
  imageCount: 2,
  faqCount: 2,
  requirementCount: 1,
  tagCount: 3,
};

describe('gigQuality', () => {
  it('scores a complete gig 100', () => {
    const q = gigQuality(full);
    expect(q.score).toBe(100);
    expect(q.checks.every((c) => c.ok)).toBe(true);
  });
  it('tells the seller exactly what to improve', () => {
    const q = gigQuality({ ...full, imageCount: 0, faqCount: 0, title: 'flutter app' });
    expect(q.score).toBe(100 - 25 - 10 - 15);
    expect(q.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(['title', 'images', 'faq']);
    expect(q.checks.find((c) => c.key === 'images')!.tip).toMatch(/Upload/);
  });
});

describe('gig templates', () => {
  it('falls back for unknown categories', () => {
    expect(gigTemplate('nope')).toBe(GIG_TEMPLATES['web-development']);
    expect(gigTemplate(null)).toBe(GIG_TEMPLATES['web-development']);
  });
  it.each(Object.keys(GIG_TEMPLATES))('%s suggestions satisfy the real service schema', (slug) => {
    const t = gigTemplate(slug);
    const parsed = serviceInputSchema.safeParse({
      categoryId: '0198f2a0-0000-7000-8000-000000000001',
      title: t.titleExamples[0],
      description: 'd'.repeat(60),
      packages: (['basic', 'standard', 'premium'] as const).map((tier) => ({
        tier,
        title: t.packages[tier].title,
        description: t.packages[tier].description,
        priceAmount: t.packages[tier].price * 100,
        deliveryDays: t.packages[tier].days,
        revisions: t.packages[tier].revisions,
      })),
      faqs: t.faqs,
      requirementsForm: t.requirements.map((label) => ({ label, type: 'longtext', required: true })),
      tags: t.tags.slice(0, 5),
    });
    expect(parsed.error?.issues).toBeUndefined();
    expect(parsed.success).toBe(true);
  });
});
