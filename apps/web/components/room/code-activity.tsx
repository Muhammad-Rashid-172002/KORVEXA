'use client';
import type { CodeEventView, CodeLinkView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { GitCommit, GitPullRequest, Rocket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { API_URL } from '@/lib/config';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

const ICON = { commits: GitCommit, pull_request: GitPullRequest, deployment: Rocket } as const;

export function CodeActivity({ projectId, isSeller }: { projectId: string; isSeller: boolean }) {
  const links = useLoad<CodeLinkView[]>(`/projects/${projectId}/code-links`);
  const feed = useLoad<{ items: CodeEventView[] }>(`/projects/${projectId}/code-activity?limit=30`);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const r = await gw('POST', `/projects/${projectId}/code-links`, {
      repo: String(new FormData(form).get('repo')).trim(),
    });
    setMsg(r.ok ? null : r.error);
    if (r.ok) form.reset();
    await links.reload();
  }
  async function disconnect(id: string) {
    const r = await gw('DELETE', `/projects/${projectId}/code-links/${id}`);
    setMsg(r.ok ? null : r.error);
    await links.reload();
  }

  const items = feed.data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Optional. When the seller connects a GitHub repository, saved changes, reviewed work and releases
        appear here in plain language.
      </p>
      {msg && <Alert tone="danger">{msg}</Alert>}
      <Card className="flex flex-col gap-3" data-testid="code-links">
        <CardTitle>Connected repositories</CardTitle>
        {(links.data ?? []).length === 0 && <p className="text-sm text-muted">No repository connected.</p>}
        <ul className="flex flex-col gap-2">
          {(links.data ?? []).map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 text-sm">
              <Badge>{l.repo}</Badge>
              {isSeller && (
                <Button size="sm" variant="ghost" onClick={() => void disconnect(l.id)}>
                  Disconnect {l.repo}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {isSeller && (
          <>
            <form className="flex flex-wrap items-end gap-2" onSubmit={connect}>
              <label className="flex flex-col gap-1 text-xs text-muted">
                GitHub repository (owner/name)
                <input
                  name="repo"
                  required
                  aria-label="GitHub repository"
                  placeholder="acme/shop-site"
                  className="h-10 w-64 rounded-md border border-border bg-surface px-3 text-sm text-fg"
                />
              </label>
              <Button type="submit" size="sm">
                Connect repository
              </Button>
            </form>
            <p className="text-xs text-muted">
              In the repository’s Settings → Webhooks, send push, pull request and deployment status events to{' '}
              <code className="rounded bg-surface px-1">{`${API_URL}/v1/webhooks/github`}</code> (content type
              JSON, with the shared secret your admin configured).
            </p>
          </>
        )}
      </Card>
      <ul className="flex flex-col gap-2" data-testid="code-feed">
        {items.map((e) => {
          const Icon = ICON[e.kind];
          return (
            <li key={e.id}>
              <Card className="flex items-start gap-3" data-testid="code-event">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{e.title}</p>
                  {e.detail && <p className="text-xs text-muted">{e.detail}</p>}
                  <p className="text-xs text-muted">
                    {e.repo} · {new Date(e.occurredAt).toLocaleString()}
                    {e.url && (
                      <>
                        {' · '}
                        <a
                          className="text-primary underline-offset-4 hover:underline"
                          href={e.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          View
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && (
        <p className="text-sm text-muted">
          No code activity yet. If the expert connects GitHub, updates appear here in plain words.
        </p>
      )}
    </div>
  );
}
