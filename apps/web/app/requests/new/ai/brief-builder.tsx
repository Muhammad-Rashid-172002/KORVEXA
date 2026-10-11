'use client';
import type { BriefSessionView, StructuredBrief } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gw } from '@/lib/gw';

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

export function BriefBuilder() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [session, setSession] = useState<BriefSessionView | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [brief, setBrief] = useState<StructuredBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await gw<BriefSessionView>('POST', '/ai/brief-sessions', { idea });
    setBusy(false);
    if (!r.data) return setError(r.error);
    setSession(r.data);
    setAnswers(r.data.questions.map(() => ''));
  }

  async function answer() {
    if (!session) return;
    setBusy(true);
    setError(null);
    const r = await gw<BriefSessionView>('POST', `/ai/brief-sessions/${session.id}/answers`, {
      answers: session.questions.map((question, i) => ({ question, answer: answers[i] ?? '' })),
    });
    setBusy(false);
    if (!r.data) return setError(r.error);
    setSession(r.data);
    setBrief(r.data.brief);
  }

  async function post() {
    if (!session || !brief) return;
    setBusy(true);
    setError(null);
    const r = await gw<{ briefId: string }>('POST', `/ai/brief-sessions/${session.id}/post`, { brief });
    setBusy(false);
    if (!r.data) return setError(r.error);
    router.push(`/requests/${r.data.briefId}`);
  }

  const set = <K extends keyof StructuredBrief>(k: K, v: StructuredBrief[K]) =>
    setBrief((b) => (b ? { ...b, [k]: v } : b));

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="danger">{error}</Alert>}

      {!session && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            Your idea
            <textarea
              aria-label="Your idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={6}
              maxLength={3000}
              placeholder="e.g. A mobile app where dog owners book walks and pay by card…"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted"
            />
          </label>
          <Button
            className="self-start"
            disabled={busy || idea.trim().length < 20}
            onClick={() => void start()}
          >
            {busy ? 'Thinking…' : 'Continue'}
          </Button>
        </>
      )}

      {session && session.status === 'asking' && (
        <Card className="flex flex-col gap-4" data-testid="brief-questions">
          <CardTitle>A few questions</CardTitle>
          {session.questions.map((q, i) => (
            <label key={i} className="flex flex-col gap-1.5 text-sm">
              {q}
              <textarea
                aria-label={q}
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                rows={2}
                maxLength={1500}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
              />
            </label>
          ))}
          <Button className="self-start" disabled={busy} onClick={() => void answer()}>
            {busy ? 'Writing your brief…' : 'Create my brief'}
          </Button>
        </Card>
      )}

      {brief && (
        <Card className="flex flex-col gap-4" data-testid="brief-draft">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Your brief</CardTitle>
            <Badge>Draft: edit anything before posting</Badge>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            Title
            <input
              aria-label="Brief title"
              value={brief.title}
              maxLength={120}
              onChange={(e) => set('title', e.target.value)}
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            Summary
            <textarea
              aria-label="Brief summary"
              value={brief.summary}
              rows={4}
              maxLength={1200}
              onChange={(e) => set('summary', e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['goals', 'Goals'],
                ['userStories', 'User stories'],
                ['platforms', 'Platforms'],
                ['integrations', 'Integrations'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex flex-col gap-1.5 text-xs text-muted">
                {label} (one per line)
                <textarea
                  aria-label={label}
                  value={brief[k].join('\n')}
                  rows={4}
                  onChange={(e) => set(k, lines(e.target.value))}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
                />
              </label>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-medium">Suggested milestones</h3>
            <ol className="list-decimal pl-5 text-sm" data-testid="brief-milestones">
              {brief.suggestedMilestones.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">{m.title}</span>: {m.description}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-md border border-border p-3 text-sm" data-testid="brief-estimate">
            <p className="font-medium">Estimates, not a quote</p>
            <p className="text-muted">
              About ${brief.estimate.budgetMinUsd.toLocaleString('en-US')} to $
              {brief.estimate.budgetMaxUsd.toLocaleString('en-US')}, roughly {brief.estimate.timelineWeeksMin}{' '}
              to {brief.estimate.timelineWeeksMax} weeks. Real prices come from sellers’ proposals.
            </p>
          </div>
          {brief.openQuestions.length > 0 && (
            <div className="text-sm">
              <h3 className="font-medium">Still to clarify</h3>
              <ul className="list-disc pl-5">
                {brief.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <Button
            className="self-start"
            disabled={busy || brief.title.trim().length < 5}
            onClick={() => void post()}
          >
            {busy ? 'Posting…' : 'Post as a request'}
          </Button>
        </Card>
      )}
    </div>
  );
}
