import type { Metadata } from 'next';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Admin · Audit log' };

interface LogRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const { action } = await searchParams;
  const res = await serverGw<{ items: LogRow[] }>(
    `/admin/audit-logs?limit=100${action ? `&action=${encodeURIComponent(action)}` : ''}`,
  );
  const rows = res.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" action="/admin/audit">
        <input
          name="action"
          defaultValue={action}
          placeholder="Filter by action, e.g. user.created"
          aria-label="Filter by action"
          className="h-10 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm"
        />
        <button className="h-10 rounded-md border border-border bg-surface-2 px-4 text-sm" type="submit">
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm" data-testid="admin-audit">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-xs text-muted">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-3 py-2 text-xs">
                  {l.entityType} {l.entityId?.slice(0, 8)}
                </td>
                <td className="px-3 py-2 text-xs text-muted">{l.actorId?.slice(0, 8) ?? 'system'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
