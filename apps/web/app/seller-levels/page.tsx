import { SELLER_LEVELS, VERIFICATION_LABELS } from '@glasswork/shared';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller levels',
  description: 'How seller levels, ratings and verification badges are earned. Computed from real data only.',
};

export default function SellerLevelsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How seller levels work</h1>
        <p className="mt-1 text-sm text-muted">
          Levels are calculated automatically from real, completed work. Nobody can buy or be granted a level
          by hand. A seller needs <strong>every</strong> criterion for a level.
        </p>
      </div>
      <ul className="flex flex-col gap-3" data-testid="level-criteria">
        {SELLER_LEVELS.map((l) => (
          <li key={l.key}>
            <Card className="flex flex-col gap-1">
              <CardTitle>{l.label}</CardTitle>
              {l.key === 'new' ? (
                <p className="text-sm text-muted">Everyone starts here.</p>
              ) : (
                <ul className="text-sm text-muted">
                  <li>{l.criteria.completedProjects}+ completed projects</li>
                  <li>{l.criteria.reviewCount}+ public reviews</li>
                  <li>Average rating of {l.criteria.avgRating.toFixed(1)} or higher</li>
                  <li>{Math.round(l.criteria.onTimeRate * 100)}%+ of milestones submitted on time</li>
                </ul>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-2" aria-labelledby="badges">
        <h2 id="badges" className="text-lg font-semibold">
          Verification badges
        </h2>
        <p className="text-sm text-muted">
          A badge appears only after it has actually been verified, never while pending.
        </p>
        <ul className="list-inside list-disc text-sm">
          {Object.values(VERIFICATION_LABELS).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
