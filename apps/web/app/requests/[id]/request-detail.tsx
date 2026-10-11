'use client';
import type { BriefView, ProposalView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { TextareaField } from '@/components/textarea-field';
import { money } from '@/lib/format';
import { gw, newIdempotencyKey } from '@/lib/gw';

type Row = { title: string; amount: string; days: string };

function ProposalCard({ p, brief, onChange }: { p: ProposalView; brief: BriefView; onChange: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());

  async function accept() {
    const r = await gw<{ projectId: string }>('POST', `/proposals/${p.id}/accept`, undefined, {
      'idempotency-key': key.current,
    });
    if (!r.data) return setError(r.error);
    router.push(`/projects/${r.data.projectId}`);
  }
  async function simple(path: string) {
    const r = await gw('POST', path);
    if (!r.ok) return setError(r.error);
    onChange();
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="proposal">
      <div className="flex items-start justify-between gap-3">
        <CardTitle>
          {p.seller.slug ? (
            <Link className="hover:underline" href={`/u/${p.seller.slug}`}>
              {p.seller.name}
            </Link>
          ) : (
            p.seller.name
          )}
        </CardTitle>
        <span className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{money(p.totalAmount, p.currency)}</span>
          <Badge>{p.status}</Badge>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm">{p.coverLetter}</p>
      <ol className="flex flex-col gap-1 text-sm text-muted">
        {p.milestonePlan.map((m, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span>
              {i + 1}. {m.title} · {m.days} days
            </span>
            <span className="tabular-nums">{money(m.amount, p.currency)}</span>
          </li>
        ))}
      </ol>
      {error && <Alert tone="danger">{error}</Alert>}
      {brief.isOwner && p.status === 'sent' && brief.status === 'open' && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void accept()}>
            Accept &amp; start project
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void simple(`/proposals/${p.id}/decline`)}>
            Decline
          </Button>
        </div>
      )}
      {!brief.isOwner && p.status === 'sent' && (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={() => void simple(`/proposals/${p.id}/withdraw`)}
        >
          Withdraw proposal
        </Button>
      )}
      {p.status === 'accepted' && p.projectId && (
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href={`/projects/${p.projectId}`}
        >
          Open project →
        </Link>
      )}
    </Card>
  );
}

function ProposeForm({ brief, onDone }: { brief: BriefView; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([
    { title: 'Kickoff & plan', amount: '', days: '7' },
    { title: 'Build', amount: '', days: '14' },
    { title: 'Delivery', amount: '', days: '7' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const r = await gw('POST', `/briefs/${brief.id}/proposals`, {
      coverLetter: String(new FormData(e.currentTarget).get('coverLetter')).trim(),
      milestonePlan: rows.map((x) => ({
        title: x.title.trim(),
        amount: Math.round(Number(x.amount) * 100),
        days: Number(x.days),
      })),
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    onDone();
  }
  const set = (i: number, patch: Partial<Row>) =>
    setRows((a) => a.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" data-testid="propose-form">
      <TextareaField
        id="coverLetter"
        label="Cover letter"
        rows={5}
        required
        minLength={20}
        maxLength={3000}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">
          Milestone plan (the buyer funds and approves each one)
        </legend>
        {rows.map((r, i) => (
          <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
            <Field
              id={`m-title-${i}`}
              label="Milestone"
              value={r.title}
              onChange={(e) => set(i, { title: e.target.value })}
              required
              minLength={2}
            />
            <Field
              id={`m-amount-${i}`}
              label="Price (USD)"
              type="number"
              min={5}
              step="0.01"
              value={r.amount}
              onChange={(e) => set(i, { amount: e.target.value })}
              required
            />
            <Field
              id={`m-days-${i}`}
              label="Days"
              type="number"
              min={1}
              max={180}
              value={r.days}
              onChange={(e) => set(i, { days: e.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              disabled={rows.length === 1}
              onClick={() => setRows((a) => a.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        {rows.length < 10 && (
          <Button
            type="button"
            variant="secondary"
            className="self-start"
            onClick={() => setRows((a) => [...a, { title: '', amount: '', days: '7' }])}
          >
            Add milestone
          </Button>
        )}
      </fieldset>
      <p className="text-sm">
        Total:{' '}
        <strong className="tabular-nums" data-testid="proposal-total">
          {money(Math.round(total * 100), brief.currency)}
        </strong>
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Sending…' : 'Send proposal'}
      </Button>
    </form>
  );
}

export function RequestDetail({ brief: b }: { brief: BriefView }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const active = b.myProposal && (b.myProposal.status === 'sent' || b.myProposal.status === 'accepted');
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{b.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge data-testid="request-status">{b.status}</Badge>
          by {b.buyer.name}
          {(b.budgetMinAmount !== null || b.budgetMaxAmount !== null) && (
            <>
              · Budget {b.budgetMinAmount !== null ? money(b.budgetMinAmount, b.currency) : '…'} –{' '}
              {b.budgetMaxAmount !== null ? money(b.budgetMaxAmount, b.currency) : '…'}
            </>
          )}
        </p>
      </div>
      <p className="whitespace-pre-wrap text-sm">{b.description}</p>

      {b.isOwner ? (
        <section aria-labelledby="props" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="props" className="text-lg font-semibold">
              Proposals ({b.proposals?.length ?? 0})
            </h2>
            {b.status === 'open' && (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/match?briefId=${b.id}`}>Find matching sellers</Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await gw('POST', `/briefs/${b.id}/close`);
                    refresh();
                  }}
                >
                  Close request
                </Button>
              </div>
            )}
          </div>
          {(b.proposals ?? []).length === 0 ? (
            <p className="text-sm text-muted">No proposals yet.</p>
          ) : (
            (b.proposals ?? []).map((p) => <ProposalCard key={p.id} p={p} brief={b} onChange={refresh} />)
          )}
        </section>
      ) : (
        <section aria-labelledby="mine" className="flex flex-col gap-3">
          <h2 id="mine" className="text-lg font-semibold">
            {active ? 'Your proposal' : 'Send a proposal'}
          </h2>
          {b.myProposal && <ProposalCard p={b.myProposal} brief={b} onChange={refresh} />}
          {!active && b.status === 'open' && <ProposeForm brief={b} onDone={refresh} />}
        </section>
      )}
    </>
  );
}
