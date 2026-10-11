'use client';
import { PREVIEW_KINDS, type MilestoneView, type PreviewView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { ExternalLink } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

export function Previews({
  projectId,
  isSeller,
  milestones,
  editable,
}: {
  projectId: string;
  isSeller: boolean;
  milestones: MilestoneView[];
  editable: boolean;
}) {
  const { data, reload, error } = useLoad<PreviewView[]>(`/projects/${projectId}/previews`);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const r = await gw('POST', `/projects/${projectId}/previews`, {
      kind: f.get('kind'),
      label: String(f.get('label')).trim(),
      url: String(f.get('url')).trim(),
      milestoneId: String(f.get('milestoneId') || '') || null,
    });
    if (!r.ok) return setMsg(r.error);
    form.reset();
    setMsg(null);
    await reload();
  }

  if (!data) return <p className="text-sm text-muted">{error ?? 'Loading previews…'}</p>;
  return (
    <div className="flex flex-col gap-4">
      {data.length === 0 ? (
        <p className="text-sm text-muted">
          No preview links yet. The seller can share a staging site, Figma file, test build or demo video
          here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="preview-list">
          {data.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {p.label} <Badge>{p.kind}</Badge>
                </p>
                <p className="text-xs text-muted" data-testid="preview-updated">
                  Updated {ago(p.lastUpdatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  className="flex items-center gap-1 text-sm text-primary hover:underline"
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Open <ExternalLink size={12} aria-hidden />
                </a>
                {isSeller && editable && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await gw('DELETE', `/projects/${projectId}/previews/${p.id}`);
                      await reload();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {msg && <Alert tone="danger">{msg}</Alert>}
      {isSeller && editable && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2" data-testid="preview-form">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Type
            <select name="kind" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg">
              {PREVIEW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Label
            <input
              name="label"
              required
              minLength={2}
              maxLength={100}
              className="h-9 w-48 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            URL (https)
            <input
              name="url"
              type="url"
              required
              className="h-9 w-72 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Milestone
            <select
              name="milestoneId"
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg"
            >
              <option value="">Whole project</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.position}. {m.title}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="sm">
            Add link
          </Button>
        </form>
      )}
    </div>
  );
}
