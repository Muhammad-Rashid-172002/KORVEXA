'use client';
import type { OrgView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { gw } from '@/lib/gw';

export function OrgManager({ org }: { org: OrgView }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const canManage = org.myRole === 'owner' || org.myRole === 'admin';

  async function act(
    fn: () => Promise<{ ok: boolean; error: string | null }>,
    ok: string,
    after?: () => void,
  ) {
    const r = await fn();
    setMsg(r.ok ? { tone: 'success', text: ok } : { tone: 'danger', text: r.error ?? 'Failed' });
    if (r.ok) (after ?? router.refresh)();
  }

  function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    void act(
      () =>
        gw('POST', `/orgs/${org.id}/invites`, { email: String(f.get('email')).trim(), role: f.get('role') }),
      'Invitation sent.',
      () => {
        form.reset();
        router.refresh();
      },
    );
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
        <p className="text-sm text-muted">
          {org.kind === 'agency' ? 'Seller agency' : 'Buyer team'} · your role: {org.myRole}
        </p>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card className="flex flex-col gap-3">
        <CardTitle>Members</CardTitle>
        <ul className="flex flex-col divide-y divide-border" data-testid="member-list">
          {org.members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{m.name}</span>
                <span className="text-xs text-muted">{m.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge>{m.role}</Badge>
                {m.role !== 'owner' && canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void act(() => gw('DELETE', `/orgs/${org.id}/members/${m.userId}`), 'Member removed.')
                    }
                  >
                    Remove
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {org.myRole !== 'owner' && (
          <Button
            variant="secondary"
            className="self-start"
            onClick={() =>
              void act(
                () => gw('DELETE', `/orgs/${org.id}/members/${org.myUserId}`),
                'You left the organization.',
                () => router.push('/orgs'),
              )
            }
          >
            Leave organization
          </Button>
        )}
      </Card>

      {canManage && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Invite a teammate</CardTitle>
          <form className="flex flex-col gap-3" onSubmit={onInvite}>
            <Field id="email" label="Email" type="email" required />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="role"
                name="role"
                className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" className="self-start">
              Send invitation
            </Button>
          </form>
          {org.invites.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm" data-testid="invite-list">
              {org.invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3">
                  <span>
                    {i.email} <span className="text-xs text-muted">({i.role}, pending)</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void act(() => gw('DELETE', `/orgs/${org.id}/invites/${i.id}`), 'Invitation revoked.')
                    }
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
