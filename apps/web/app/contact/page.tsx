import { brand } from '@glasswork/shared/brand';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get help with ${brand.productName}: help center, in-product reporting and support.`,
};

export default function ContactPage() {
  const company = [brand.legalEntity, brand.legalAddress].filter(Boolean).join(' · ');
  return (
    <ProsePage
      eyebrow="Contact"
      title="Talk to a human"
      description="Most questions are answered faster in the Help center. For anything about a live project, use the tools inside the product so we can see the context."
    >
      <Block title="Help center">
        <p>
          Step-by-step guides for projects, steps, payments, disputes and your account are in the{' '}
          <Link href="/help">Help center</Link>.
        </p>
      </Block>
      <Block title="Support">
        {brand.supportEmail ? (
          <p>
            Email <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>. Include your project code
            (for example GW-0001) so we can find it quickly.
          </p>
        ) : (
          <p>
            Signed-in members can reach us through <Link href="/messages">Messages</Link>. Include your
            project code (for example GW-0001) so we can find it quickly.
          </p>
        )}
      </Block>
      <Block title="Disputes and safety reports">
        <p>
          Use the Report and Open a dispute buttons inside the product so the evidence is attached
          automatically. See <Link href="/help/open-a-dispute">how disputes work</Link> and{' '}
          <Link href="/trust">Trust &amp; safety</Link>.
        </p>
      </Block>
      <Block title="Company">
        <p>
          {brand.productName} is a product of{' '}
          <a href={brand.parentUrl} rel="noopener">
            {brand.parentName}
          </a>
          {company && company !== brand.parentName ? `. ${company}` : ''}.
        </p>
      </Block>
    </ProsePage>
  );
}
