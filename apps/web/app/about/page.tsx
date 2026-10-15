import { brand } from '@glasswork/shared/brand';
import type { Metadata } from 'next';
import { Block, ProsePage } from '@/components/marketing/prose-page';

export const metadata: Metadata = {
  title: 'About',
  description: `${brand.productName} is owned and operated by ${brand.parentName}.`,
};

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title={`${brand.productName} by ${brand.parentName}`}>
      <Block title="Why we are building this">
        <p>
          Hiring someone to build software is stressful because you cannot see the work. {brand.productName}{' '}
          makes the work visible: what is done, what is next, what is blocked and what you are paying for.
        </p>
      </Block>
      <Block title="Who runs it">
        <p>
          {brand.productName} is a product of{' '}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={brand.parentUrl}
            rel="noopener"
          >
            {brand.parentName}
          </a>
          , a software company run by three partners: Muhammad Rashid (Founder &amp; CEO), Muhammad Taha Amir
          (Co-Founder) and Suliman (COO).
        </p>
      </Block>
      <Block title="Our rules for ourselves">
        <ul className="list-disc space-y-2 pl-5">
          <li>No fabricated sellers, reviews, counts or customer logos, ever.</li>
          <li>Services run by {brand.parentName}&apos;s agency are labelled and get no ranking advantage.</li>
          <li>AI assists; it never makes money or trust decisions.</li>
        </ul>
      </Block>
    </ProsePage>
  );
}
