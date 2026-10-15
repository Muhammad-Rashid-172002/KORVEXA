import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'From brief to shipped software, milestone by milestone.',
};

export default function HowItWorksPage() {
  return (
    <ProsePage eyebrow="How it works" title="A project you can follow from first brief to final payment">
      <Block title="1. Start with a brief or a service">
        <p>
          Pick a ready-made service with Basic, Standard and Premium packages, or post a request. The AI brief
          builder asks a few clarifying questions and turns your idea into goals, user stories, platforms and
          suggested milestones. Budget and timeline ranges are estimates, never quotes.
        </p>
      </Block>
      <Block title="2. Compare builders on real data">
        <p>
          Reviews come only from paying buyers with completed work. Seller levels are computed from real
          metrics with published criteria. Verification badges (identity, GitHub, store links, portfolio
          review, skill test) appear only when actually verified. Matching is rule-based; AI only explains the
          result.
        </p>
      </Block>
      <Block title="3. Fund milestone by milestone">
        <p>
          Each milestone is funded separately and held in escrow. The seller starts work, submits
          deliverables, and you approve or request changes with feedback pinned to a file or screenshot
          region. Approved milestones release funds; if you do not respond within the review window (with
          reminders first), the milestone auto-approves.
        </p>
      </Block>
      <Block title="4. Follow everything in the project room">
        <p>
          Overall progress is weighted by milestone value, with the current milestone, next deadline and a
          health status that always carries a reason. Use the board, versioned deliverables, live previews,
          chat, meetings with consented recording, optional GitHub activity and plain-English weekly reports.
        </p>
      </Block>
      <Block title="5. Handle change and conflict properly">
        <p>
          Scope changes go through a change request with time and price impact. If something goes wrong, a
          dispute builds a case file from messages, deliverable versions, approvals and timeline. Our
          operations team resolves it with a release, refund or split.
        </p>
      </Block>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/services">Browse services</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/pricing">Fees & escrow</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
