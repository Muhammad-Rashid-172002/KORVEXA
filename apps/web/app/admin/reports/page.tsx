import { Badge } from '@glasswork/ui/components/badge';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import type { Metadata } from 'next';
import { serverGw } from '@/lib/server-gw';
import { ReportActions } from './report-actions';

export const metadata: Metadata = { title: 'Admin · Reports' };
export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  reporter: string;
  createdAt: string;
  target: { label: string; ownerId: string | null; excerpt: string | null };
}

export default async function AdminReports() {
  const res = await serverGw<Row[]>('/admin/reports?status=open');
  const rows = res.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Open reports ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No open reports.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="report-queue">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle>{r.target.label}</CardTitle>
                  <Badge>{r.targetType}</Badge>
                </div>
                <p className="text-sm">
                  <strong>{r.reason}</strong> · reported by {r.reporter} ·{' '}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.details && <p className="text-xs text-muted">{r.details}</p>}
                {r.target.excerpt && (
                  <blockquote className="border-l-2 border-border pl-3 text-sm text-muted">
                    {r.target.excerpt}
                  </blockquote>
                )}
                <ReportActions
                  id={r.id}
                  targetType={r.targetType}
                  targetId={r.targetId}
                  ownerId={r.target.ownerId}
                  label={r.target.label}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
