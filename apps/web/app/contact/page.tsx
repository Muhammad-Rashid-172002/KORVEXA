import { brand } from '@glasswork/shared/brand';
import type { Metadata } from 'next';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = { title: 'Contact' };

export default function ContactPage() {
  return (
    <ProsePage eyebrow="Contact" title="Talk to a human">
      <Block title="Support">
        <p>
          Email{' '}
          <a className="text-primary hover:underline" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
          . Include your project code (for example GW-0001) so we can find it quickly.
        </p>
      </Block>
      <Block title="Disputes and safety reports">
        <p>
          Use the Report and Dispute buttons inside the product so the evidence is attached automatically.
        </p>
      </Block>
      <Block title="Company">
        <p>
          {brand.legalEntity} · {brand.legalAddress}
        </p>
      </Block>
    </ProsePage>
  );
}
