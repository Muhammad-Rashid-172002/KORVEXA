'use client';
import type { DeliverableView, MilestoneView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { useState, type FormEvent } from 'react';
import { gw, uploadFile } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

const anchorLabel = (a: DeliverableView['feedback'][number]['anchor']) =>
  a.kind === 'timecode'
    ? `at ${a.t ?? 0}s`
    : a.kind === 'region'
      ? `pinned${a.page ? ` on page ${a.page}` : ''} (${Math.round((a.x ?? 0) * 100)}%, ${Math.round((a.y ?? 0) * 100)}%)`
      : a.page
        ? `page ${a.page}`
        : 'general';

function Feedback({
  d,
  projectEditable,
  onChange,
}: {
  d: DeliverableView;
  projectEditable: boolean;
  onChange: () => void;
}) {
  const [kind, setKind] = useState<'page' | 'region' | 'timecode'>('page');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isImage = d.file.mimeType.startsWith('image/');

  async function showImage() {
    const r = await gw<{ url: string }>('GET', `/deliverables/${d.id}/download`);
    if (r.data) setImageUrl(r.data.url);
    else setError(r.error);
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const page = Number(f.get('page')) || undefined;
    const t = Number(f.get('t')) || 0;
    const anchor =
      kind === 'timecode'
        ? { kind, t }
        : kind === 'region'
          ? { kind, page, x: pin?.x ?? 0, y: pin?.y ?? 0, w: 0, h: 0 }
          : { kind, page };
    const r = await gw('POST', `/deliverables/${d.id}/feedback`, {
      anchor,
      body: String(f.get('body')).trim(),
    });
    if (!r.ok) return setError(r.error);
    form.reset();
    setPin(null);
    setError(null);
    onChange();
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {d.feedback.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="feedback-list">
          {d.feedback.map((fb) => (
            <li key={fb.id} className="flex items-start justify-between gap-3 text-sm">
              <span className={fb.resolved ? 'text-muted line-through' : ''}>
                <strong>{fb.author.name}</strong>{' '}
                <span className="text-xs text-muted">({anchorLabel(fb.anchor)})</span>: {fb.body}
              </span>
              {projectEditable && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-primary hover:underline"
                  onClick={async () => {
                    await gw('PUT', `/deliverable-feedback/${fb.id}/resolved`, { resolved: !fb.resolved });
                    onChange();
                  }}
                >
                  {fb.resolved ? 'Reopen' : 'Resolve'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isImage && (
        <div className="flex flex-col gap-2">
          {!imageUrl ? (
            <Button size="sm" variant="secondary" className="self-start" onClick={() => void showImage()}>
              Preview image to pin feedback
            </Button>
          ) : (
            <div className="relative inline-block max-w-full self-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned URL */}
              <img
                src={imageUrl}
                alt={`Deliverable v${d.version}: click to pin feedback`}
                data-testid="feedback-image"
                className="max-h-72 cursor-crosshair rounded-md border border-border"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setKind('region');
                  setPin({
                    x: Number(((e.clientX - r.left) / r.width).toFixed(3)),
                    y: Number(((e.clientY - r.top) / r.height).toFixed(3)),
                  });
                }}
              />
              {d.feedback
                .filter((x) => x.anchor.kind === 'region' && x.anchor.w !== undefined)
                .map((x) => (
                  <span
                    key={x.id}
                    aria-hidden
                    className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-bg"
                    style={{ left: `${(x.anchor.x ?? 0) * 100}%`, top: `${(x.anchor.y ?? 0) * 100}%` }}
                  />
                ))}
              {pin && (
                <span
                  aria-hidden
                  className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-warning ring-2 ring-bg"
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {projectEditable && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2" data-testid="feedback-form">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Pin to
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg"
              aria-label="Feedback anchor type"
            >
              <option value="page">Page / general</option>
              <option value="region">Image spot (click the image)</option>
              <option value="timecode">Video time</option>
            </select>
          </label>
          {kind !== 'timecode' && (
            <input
              name="page"
              type="number"
              min={1}
              aria-label="Page number"
              placeholder="Page"
              className="h-9 w-20 rounded-md border border-border bg-bg px-2 text-sm"
            />
          )}
          {kind === 'timecode' && (
            <input
              name="t"
              type="number"
              min={0}
              step="0.1"
              aria-label="Seconds"
              placeholder="Seconds"
              className="h-9 w-24 rounded-md border border-border bg-bg px-2 text-sm"
            />
          )}
          <input
            name="body"
            required
            maxLength={4000}
            aria-label="Feedback"
            placeholder="What should change?"
            className="h-9 min-w-48 flex-1 rounded-md border border-border bg-bg px-3 text-sm"
          />
          <Button size="sm" type="submit">
            Add feedback
          </Button>
        </form>
      )}
    </div>
  );
}

export function Deliverables({
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
  const { data, reload, error } = useLoad<DeliverableView[]>(`/projects/${projectId}/deliverables`);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(milestoneId: string, file: File, note: string) {
    setBusy(true);
    setMsg(null);
    try {
      const fileId = await uploadFile(file, 'deliverable');
      const r = await gw('POST', `/milestones/${milestoneId}/deliverables`, {
        fileId,
        note: note || undefined,
      });
      if (!r.ok) throw new Error(r.error ?? 'Could not add deliverable');
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    const r = await gw<{ url: string }>('GET', `/deliverables/${id}/download`);
    if (r.data) window.open(r.data.url, '_blank', 'noopener,noreferrer');
    else setMsg(r.error ?? 'File not available');
  }

  if (!data) return <p className="text-sm text-muted">{error ?? 'Loading deliverables…'}</p>;
  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone="danger">{msg}</Alert>}
      {milestones
        .filter((m) => !['cancelled', 'refunded'].includes(m.status))
        .map((m) => {
          const versions = data.filter((d) => d.milestoneId === m.id);
          const canUpload = isSeller && editable && ['in_progress', 'revision_requested'].includes(m.status);
          return (
            <section
              key={m.id}
              aria-labelledby={`dm-${m.id}`}
              className="flex flex-col gap-3"
              data-testid={`deliverables-${m.position}`}
            >
              <h3 id={`dm-${m.id}`} className="text-sm font-semibold">
                {m.position}. {m.title}
              </h3>
              {versions.length === 0 && <p className="text-sm text-muted">No deliverables yet.</p>}
              {versions.map((d) => (
                <article
                  key={d.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
                  data-testid="deliverable"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      v{d.version} · {d.file.name}
                      <Badge data-testid="deliverable-status">{d.status.replace('_', ' ')}</Badge>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={d.file.status !== 'clean'}
                      onClick={() => void download(d.id)}
                    >
                      {d.file.status === 'clean' ? 'Download' : 'Scanning…'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted">
                    {d.submittedBy.name} · {new Date(d.createdAt).toLocaleString()}
                    {d.note && ` · ${d.note}`}
                  </p>
                  {d.status !== 'superseded' && (
                    <Feedback d={d} projectEditable={editable} onChange={() => void reload()} />
                  )}
                  {d.status === 'superseded' && d.feedback.length > 0 && (
                    <p className="text-xs text-muted">
                      {d.feedback.length} feedback item(s) on this older version.
                    </p>
                  )}
                </article>
              ))}
              {canUpload && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const file = f.get('file') as File;
                    if (file?.size) void upload(m.id, file, String(f.get('note') ?? '').trim());
                  }}
                >
                  <input
                    type="file"
                    name="file"
                    required
                    data-testid={`deliverable-input-${m.position}`}
                    aria-label={`Upload deliverable for milestone ${m.position}`}
                    accept="application/zip,application/pdf,image/png,image/jpeg,image/webp,video/mp4,text/plain,application/vnd.android.package-archive"
                  />
                  <input
                    name="note"
                    maxLength={2000}
                    aria-label="Note"
                    placeholder="Note for the buyer (optional)"
                    className="h-9 min-w-48 rounded-md border border-border bg-bg px-3 text-sm"
                  />
                  <Button size="sm" type="submit" disabled={busy}>
                    {busy ? 'Uploading…' : versions.length ? 'Upload new version' : 'Upload deliverable'}
                  </Button>
                </form>
              )}
            </section>
          );
        })}
    </div>
  );
}
