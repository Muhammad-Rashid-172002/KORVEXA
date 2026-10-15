import { brand } from '@glasswork/shared/brand';
import { Card } from '@glasswork/ui/components/card';
import type { ReactNode } from 'react';
import { ProductMark } from './product-mark';

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-hero-glow flex flex-1 justify-center">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
        <div className="flex flex-col gap-1">
          <ProductMark size={36} />
          <p className="mt-2 text-xs uppercase tracking-wider text-muted">{brand.lockup}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <Card className="flex flex-col gap-5 shadow-xl">{children}</Card>
      </div>
    </div>
  );
}
