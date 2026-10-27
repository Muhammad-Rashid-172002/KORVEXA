import { brand } from '@glasswork/shared/brand';
import Link from 'next/link';
import { CookieSettingsLink } from './cookie-consent';
import { ProductMark } from './product-mark';

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Marketplace',
    links: [
      { href: '/services', label: 'Browse services' },
      { href: '/requests', label: 'Buyer requests' },
      { href: '/requests/new/ai', label: 'AI brief builder' },
      { href: '/match', label: 'Find a match' },
    ],
  },
  {
    title: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/pricing', label: 'Fees & escrow' },
      { href: '/trust', label: 'Trust & safety' },
      { href: '/seller-levels', label: 'Seller levels' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/for-sellers', label: 'Become a seller' },
      { href: '/seller/onboarding', label: 'Seller onboarding' },
      { href: '/sell/services', label: 'Your services' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/help', label: 'Help center' },
      { href: '/contact', label: 'Contact' },
      { href: '/legal/terms', label: 'Terms of Service' },
      { href: '/legal/privacy', label: 'Privacy Policy' },
      { href: '/legal/buyer-protection', label: 'Buyer Protection' },
      { href: '/legal/seller-agreement', label: 'Seller Agreement' },
      { href: '/legal/acceptable-use', label: 'Acceptable Use' },
      { href: '/legal/cookies', label: 'Cookie Policy' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <div className="flex items-center gap-2 font-semibold">
            <ProductMark /> {brand.productName}
          </div>
          <p className="mt-3 text-sm text-muted">{brand.tagline}</p>
          <a
            className="mt-3 inline-block text-xs text-muted hover:text-fg"
            href={brand.parentUrl}
            rel="noopener"
          >
            A product of {brand.parentName} · {brand.parentDomain}
          </a>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link className="text-fg/80 hover:text-primary" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
              {c.title === 'Company' && (
                <li>
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted sm:flex-row sm:justify-between">
          <span>
            {brand.lockup} · © {new Date().getFullYear()} {brand.legalEntity}
          </span>
        </div>
      </div>
    </footer>
  );
}
