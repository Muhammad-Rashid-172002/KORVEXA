import { Button } from '@glasswork/ui/components/button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'Trust & safety',
  description: 'How we protect buyers and sellers.',
};

export default function TrustPage() {
  return (
    <ProsePage eyebrow="Trust & safety" title="Trust is designed in, not promised">
      <Block title="Verified means verified">
        <p>
          Identity, GitHub, store developer links, portfolio review and skill tests are shown as badges only
          after they actually pass. Nothing is self-declared.
        </p>
      </Block>
      <Block title="Reviews you can believe">
        <p>
          Only paying buyers whose work was completed can leave a public review, with sub-ratings for
          communication, quality and timeliness. Sellers can reply once. Reports are triaged by people.
        </p>
      </Block>
      <Block title="Chat safety">
        <p>
          Before an order exists, we warn both sides if contact details or off-platform payment is suggested.
          We log it and never silently block or alter messages. Paying outside the platform removes payment
          protection and dispute protection.
        </p>
      </Block>
      <Block title="Disputes with evidence">
        <p>
          Either party can open a dispute on a funded milestone. A case file is collected automatically, and
          every resolution (release, refund or split) is audited with exact amounts.
        </p>
      </Block>
      <Block title="Security">
        <p>
          Passwords are hashed with argon2id, optional two-factor authentication is available, sessions can be
          revoked everywhere, and files are served only to the people allowed to see them and only after
          scanning.
        </p>
      </Block>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link href="/legal/buyer-protection">Buyer Protection</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/seller-levels">Seller levels</Link>
        </Button>
      </div>
    </ProsePage>
  );
}
