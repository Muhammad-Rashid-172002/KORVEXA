import { brand } from '@glasswork/shared/brand';
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between">
        <span>
          {brand.lockup} · © {new Date().getFullYear()} {brand.legalEntity}
        </span>
        <span className="flex gap-4">
          <Link className="hover:text-fg" href="/services">
            Browse services
          </Link>
          <Link className="hover:text-fg" href="/seller-levels">
            Seller levels
          </Link>
          <a className="hover:text-fg" href={brand.parentUrl} rel="noopener">
            {brand.parentDomain}
          </a>
        </span>
      </div>
    </footer>
  );
}
