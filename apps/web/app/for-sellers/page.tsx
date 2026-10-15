import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'Become a seller',
  description: 'Sell software services with milestone-protected payments.',
};

export default function ForSellersPage() {
  return (
    <ProsePage
      eyebrow="For sellers"
      title="Get paid for approved work, with a reputation built on real projects"
      description="Individuals and agencies welcome. One account can both buy and sell."
    >
      <Block title="What you get">
        <ul className="list-disc space-y-2 pl-5">
          <li>A public profile, portfolio and service pages with structured data for search engines.</li>
          <li>Three-package services with extras, FAQs and a requirements form.</li>
          <li>A project room that keeps buyers informed so you spend less time on status updates.</li>
          <li>
            AI progress report drafts you edit before they are sent, and meeting notes that become tasks.
          </li>
          <li>
            Analytics from real data: earnings, proposal conversion, response time, on-time delivery, repeat
            buyers.
          </li>
        </ul>
      </Block>
      <Block title="How you get started">
        <p>
          Create an account, switch to seller mode and complete the onboarding wizard: profile, skills,
          portfolio, rates, payout details and identity verification. Services go through a short moderation
          review before they are listed.
        </p>
      </Block>
      <Block title="How levels work">
        <p>
          Levels are computed from completed projects, ratings, on-time delivery and response time. The
          criteria are public.
        </p>
      </Block>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Create an account</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/seller-levels">See level criteria</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
