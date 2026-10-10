import { brand } from '@glasswork/shared/brand';
import Link from 'next/link';

/** Phase 0 text lockup: "<product> by <parent>". The final product mark arrives in Phase 8 (D-043). */
export function BrandLockup() {
  return (
    <Link href="/" className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap font-semibold tracking-tight text-fg" aria-label={brand.lockup}>
      <span aria-hidden className="inline-block size-2.5 translate-y-[-1px] rounded-sm bg-primary" />
      <span className="text-base">{brand.productName}</span>
      <span className="text-[11px] font-normal text-muted sm:text-xs">by {brand.parentName}</span>
    </Link>
  );
}
