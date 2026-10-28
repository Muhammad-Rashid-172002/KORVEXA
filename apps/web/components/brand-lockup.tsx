import { brand } from '@glasswork/shared/brand';
import Link from 'next/link';
import { ProductMark } from './product-mark';

/** "<product> by <parent>" lockup with the product mark. The KorvenzaTech K is added when the SVG arrives. */
export function BrandLockup() {
  return (
    <Link
      href="/"
      className="flex min-w-0 items-center gap-2 whitespace-nowrap font-semibold tracking-tight text-fg"
    >
      <ProductMark />
      <span className="flex items-baseline gap-1.5">
        <span className="text-base">{brand.productName}</span>
        <span className="text-[11px] font-normal text-muted sm:text-xs">by {brand.parentName}</span>
      </span>
    </Link>
  );
}
