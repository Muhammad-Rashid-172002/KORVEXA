import { BrandLockup } from './brand-lockup';
import { HeaderNav } from './header-nav';

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <BrandLockup />
        <HeaderNav />
      </div>
    </header>
  );
}
