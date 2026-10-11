import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import Link from 'next/link';
import { serverGw } from '@/lib/server-gw';
import { VerificationActions } from './verification-actions';

export const metadata: Metadata = { title: 'Admin · Verifications' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  sellerName: string;
  sellerSlug: string | null;
  kind: string;
  label: string;
  evidence: { url: string | null; handle: string | null; note: string | null };
  hasFile: boolean;
}

export default async function AdminVerifications() {
  const res = await serverGw<Row[]>('/admin/verifications?status=pending');
  const rows = res.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Waiting for review ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No verification requests are waiting.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="verification-queue">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{r.label}</CardTitle>
                  <Badge>{r.kind}</Badge>
                </div>
                <p className="text-sm">
                  Seller:{' '}
                  {r.sellerSlug ? (
                    <Link className="text-primary hover:underline" href={`/u/${r.sellerSlug}`}>
                      {r.sellerName}
                    </Link>
                  ) : (
                    r.sellerName
                  )}
                </p>
                <dl className="text-xs text-muted">
                  {r.evidence.url && (
                    <div>
                      Link:{' '}
                      <a
                        className="text-primary hover:underline"
                        href={r.evidence.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                      >
                        {r.evidence.url}
                      </a>
                    </div>
                  )}
                  {r.evidence.handle && <div>Handle: {r.evidence.handle}</div>}
                  {r.evidence.note && <div>Note: {r.evidence.note}</div>}
                </dl>
                <VerificationActions id={r.id} hasFile={r.hasFile} label={r.label} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
