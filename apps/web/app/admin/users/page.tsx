import { Badge } from '@glasswork/ui/components/badge';
import type { Metadata } from 'next';
import { serverGw } from '@/lib/server-gw';

export const metadata: Metadata = { title: 'Admin · Users' };

interface UserRow {
  id: string;
  email: string;
  name: string;
  roles: string[];
  adminScopes: string[];
  emailVerified: boolean;
  isSeed: boolean;
  createdAt: string;
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const res = await serverGw<{ items: UserRow[] }>(
    `/admin/users?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );
  const rows = res.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" action="/admin/users">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name or email"
          aria-label="Search users"
          className="h-10 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm"
        />
        <button className="h-10 rounded-md border border-border bg-surface-2 px-4 text-sm" type="submit">
          Search
        </button>
      </form>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm" data-testid="admin-users">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Scopes</th>
              <th className="px-3 py-2">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <div>{u.name}</div>
                  <div className="text-xs text-muted">
                    {u.email}
                    {!u.emailVerified && ' (unverified)'}
                    {u.isSeed && ' [dev seed]'}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r}>{r}</Badge>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{u.adminScopes.join(', ') || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
