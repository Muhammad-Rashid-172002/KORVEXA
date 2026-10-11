'use client';
import type { MilestoneView, ProjectView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TextareaField } from '@/components/textarea-field';
import { money } from '@/lib/format';
import { gw, newIdempotencyKey } from '@/lib/gw';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Not funded',
  funded: 'Funded · held until approved',
  in_progress: 'In progress',
  submitted: 'Waiting for buyer review',
  revision_requested: 'Changes requested',
  approved: 'Approved',
  released: 'Paid to seller',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  disputed: 'Disputed',
};

export function ProjectMoney({ project: p }: { project: ProjectView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ id: string; kind: 'submit' | 'revision' } | null>(null);

  async function act(key: string, fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setBusy(key);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setForm(null);
    router.refresh();
  }

  async function fund(m: MilestoneView) {
    await act(`fund-${m.id}`, async () => {
      const r = await gw<{ checkoutUrl: string | null }>('POST', `/milestones/${m.id}/fund`, undefined, {
        'idempotency-key': newIdempotencyKey(),
      });
      if (r.data?.checkoutUrl) window.location.assign(r.data.checkoutUrl);
      return r;
    });
  }

  return (
    <>
      <div>
        <p className="text-xs text-muted">{p.code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge data-testid="project-status">{p.status.replace(/_/g, ' ')}</Badge>
          Buyer {p.buyer.name} · Seller{' '}
          {p.seller.slug ? (
            <Link className="text-primary underline-offset-4 hover:underline" href={`/u/${p.seller.slug}`}>
              {p.seller.name}
            </Link>
          ) : (
            p.seller.name
          )}
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall progress</span>
          <span className="tabular-nums" data-testid="progress-value">
            {p.progress}%
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={p.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${p.progress}%` }}
          />
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Project total</dt>
            <dd className="tabular-nums">{money(p.totalAmount, p.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Held for milestones</dt>
            <dd className="tabular-nums" data-testid="escrow-held">
              {money(p.escrow.held, p.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Paid to seller</dt>
            <dd className="tabular-nums" data-testid="escrow-released">
              {money(p.escrow.released, p.currency)}
            </dd>
          </div>
        </dl>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {p.status === 'requirements_submitted' && (
        <Card className="flex flex-col gap-3">
          <CardTitle>{p.myRole === 'seller' ? 'New order' : 'Waiting for the seller'}</CardTitle>
          {p.requirements.answers.length > 0 && (
            <dl className="flex flex-col gap-2 text-sm">
              {p.requirements.answers.map((a, i) => (
                <div key={i}>
                  <dt className="text-xs text-muted">{a.question}</dt>
                  <dd className="whitespace-pre-wrap">{a.answer || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
          {p.requirements.notes && <p className="whitespace-pre-wrap text-sm">{p.requirements.notes}</p>}
          <p className="text-sm text-muted">
            {p.myRole === 'seller'
              ? p.canAccept
                ? 'The first milestone is funded. Accept to start the project.'
                : 'The buyer has not funded the first milestone yet.'
              : p.milestones[0]?.status === 'funded'
                ? 'Your first milestone is funded. The seller will accept the order.'
                : 'Fund the first milestone so the seller can accept.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {p.canAccept && (
              <Button
                disabled={busy !== null}
                onClick={() => void act('accept', () => gw('POST', `/projects/${p.id}/accept`))}
              >
                Accept order
              </Button>
            )}
            {p.canDecline && (
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() =>
                  void act('decline', () =>
                    gw('POST', `/projects/${p.id}/decline`, {
                      reason: p.myRole === 'seller' ? 'Declined by the seller' : 'Withdrawn by the buyer',
                    }),
                  )
                }
              >
                {p.myRole === 'seller' ? 'Decline' : 'Withdraw order'}
              </Button>
            )}
          </div>
        </Card>
      )}

      <section aria-labelledby="ms" className="flex flex-col gap-3">
        <h2 id="ms" className="text-lg font-semibold">
          Milestones
        </h2>
        <ol className="flex flex-col gap-3" data-testid="milestones">
          {p.milestones.map((m) => (
            <li key={m.id}>
              <Card className="flex flex-col gap-3" data-testid={`milestone-${m.position}`}>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="min-w-0">
                    {m.position}. {m.title}
                  </CardTitle>
                  <Badge data-testid="milestone-status">{STATUS_LABEL[m.status] ?? m.status}</Badge>
                </div>
                <p className="text-sm text-muted">
                  <span className="tabular-nums">{money(m.amount, m.currency)}</span>
                  {m.plannedDue && <> · due {m.plannedDue}</>}
                  {m.revisionCount > 0 && (
                    <>
                      {' '}
                      · {m.revisionCount} revision{m.revisionCount === 1 ? '' : 's'}
                    </>
                  )}
                </p>
                {m.submissionNote && <p className="text-sm">Seller note: {m.submissionNote}</p>}
                {m.revisionNote && m.status === 'revision_requested' && (
                  <p className="text-sm">Requested changes: {m.revisionNote}</p>
                )}
                {m.status === 'submitted' && m.autoApproveAt && (
                  <p className="text-xs text-muted">
                    Approved automatically on {new Date(m.autoApproveAt).toLocaleDateString()} unless the
                    buyer responds.
                  </p>
                )}
                {m.actions.includes('fund') && p.myRole === 'buyer' && (
                  <p className="text-xs text-muted" data-testid="fund-breakdown">
                    Pay {money(m.quote.buyerTotal, m.currency)}
                    {m.quote.buyerFee > 0 &&
                      ` (${money(m.amount, m.currency)} + ${money(m.quote.buyerFee, m.currency)} service fee)`}
                    . Held until you approve this milestone.
                  </p>
                )}
                {p.myRole === 'seller' &&
                  m.status !== 'pending' &&
                  m.status !== 'cancelled' &&
                  m.status !== 'refunded' && (
                    <p className="text-xs text-muted">
                      You receive {money(m.quote.sellerNet, m.currency)} after{' '}
                      {money(m.quote.sellerCommission, m.currency)} platform commission.
                    </p>
                  )}

                <div className="flex flex-wrap gap-2">
                  {m.actions.includes('fund') && (
                    <Button size="sm" disabled={busy !== null} onClick={() => void fund(m)}>
                      {m.payment?.status === 'pending' ? 'Continue to payment' : 'Fund milestone'}
                    </Button>
                  )}
                  {m.actions.includes('start') && (
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void act(`start-${m.id}`, () => gw('POST', `/milestones/${m.id}/start`))}
                    >
                      Start work
                    </Button>
                  )}
                  {m.actions.includes('submit') && (
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => setForm({ id: m.id, kind: 'submit' })}
                    >
                      Submit for review
                    </Button>
                  )}
                  {m.actions.includes('approve') && (
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(`approve-${m.id}`, () => gw('POST', `/milestones/${m.id}/approve`))
                      }
                    >
                      Approve &amp; release payment
                    </Button>
                  )}
                  {m.actions.includes('request_revision') && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => setForm({ id: m.id, kind: 'revision' })}
                    >
                      Request changes
                    </Button>
                  )}
                </div>

                {form?.id === m.id && (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const note = String(new FormData(e.currentTarget).get('note')).trim();
                      void act(`form-${m.id}`, () =>
                        form.kind === 'submit'
                          ? gw('POST', `/milestones/${m.id}/submit`, { note: note || undefined })
                          : gw('POST', `/milestones/${m.id}/request-revision`, { note }),
                      );
                    }}
                  >
                    <TextareaField
                      id="note"
                      label={form.kind === 'submit' ? 'Note for the buyer (optional)' : 'What should change?'}
                      rows={3}
                      required={form.kind === 'revision'}
                      minLength={form.kind === 'revision' ? 5 : undefined}
                      maxLength={2000}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit" disabled={busy !== null}>
                        {form.kind === 'submit' ? 'Submit' : 'Send request'}
                      </Button>
                      <Button size="sm" type="button" variant="ghost" onClick={() => setForm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
