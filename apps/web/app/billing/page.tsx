import type { InvoiceView } from '@glasswork/shared';
import { Card } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { API_URL } from '@/lib/config';
import { money } from '@/lib/format';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const res = await serverGw<InvoiceView[]>('/me/invoices');
  if (res.status === 401 || !res.data) redirect('/login?next=/billing');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      {res.data.length === 0 ? (
        <p className="text-sm text-muted">
          No payments yet. Receipts appear here after you fund a milestone.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="invoice-list">
          {res.data.map((i) => (
            <li key={i.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{i.number}</p>
                    <p className="text-xs text-muted">{new Date(i.issuedAt).toLocaleDateString()}</p>
                  </div>
                  <span className="font-semibold tabular-nums">{money(i.totalAmount, i.currency)}</span>
                </div>
                <ul className="text-sm text-muted">
                  {i.lineItems.map((l, idx) => (
                    <li key={idx} className="flex justify-between gap-3">
                      <span>{l.description}</span>
                      <span className="tabular-nums">{money(l.amount, i.currency)}</span>
                    </li>
                  ))}
                </ul>
                <a
                  className="self-start text-sm text-primary underline-offset-4 hover:underline"
                  href={`${API_URL}/v1/invoices/${i.id}/pdf`}
                >
                  Download receipt (PDF)
                </a>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
