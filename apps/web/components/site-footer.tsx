import { brand } from '@glasswork/shared/brand';

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between">
        <span>
          {brand.lockup} · © {new Date().getFullYear()} {brand.legalEntity}
        </span>
        <a className="hover:text-fg" href={brand.parentUrl} rel="noopener">
          {brand.parentDomain}
        </a>
      </div>
    </footer>
  );
}
