import { brand } from '@glasswork/shared/brand';
import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'Fees & payment protection',
  description: 'Transparent fees and step-by-step payment protection.',
};

export default function PricingPage() {
  return (
    <ProsePage
      eyebrow="Fees & payment protection"
      title="No hidden fees. You see the full breakdown before you pay."
      description="Joining and browsing are free. Fees apply only when a milestone is funded."
    >
      <Block title="What you pay as a buyer">
        <p>
          The price of the package or milestone, plus a service fee if one is configured. Before every payment
          the checkout shows the milestone price, the service fee and the total, calculated on our servers,
          never in your browser.
        </p>
      </Block>
      <Block title="What sellers receive">
        <p>
          The milestone price minus the platform commission, fixed at the moment the milestone is funded so it
          cannot change mid-project. Sellers can see their commission and earnings on the earnings page and in
          analytics.
        </p>
      </Block>
      <Block title="How payment protection works for both sides">
        <ul className="list-disc space-y-2 pl-5">
          <li>Funds are held per milestone, not for the whole project.</li>
          <li>
            Release happens on your approval, or on auto-approval after the review window with reminders
            first.
          </li>
          <li>A funded milestone under dispute is frozen until our team resolves it.</li>
          <li>Every payment is recorded, so any balance can always be explained.</li>
        </ul>
      </Block>
      <Block title="Services operated by us">
        <p>
          Services listed by {brand.parentName}&apos;s own agency are labelled &quot;{brand.operatedByLabel}
          &quot; and receive no ranking advantage. This is enforced by an automated test.
        </p>
      </Block>
      <Button asChild size="lg" className="self-start">
        <Link href="/services">Browse services</Link>
      </Button>
    </ProsePage>
  );
}
