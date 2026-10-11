'use client';
import type { MatchView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useState } from 'react';
import { gw } from '@/lib/gw';

const FACTOR_LABELS: [keyof MatchView['factors'], string][] = [
  ['skills', 'Skills'],
  ['rating', 'Reviews'],
  ['verified', 'Verified'],
  ['responseHours', 'Replies'],
  ['availability', 'Availability'],
  ['budget', 'Budget'],
];

export function MatchForm({
  briefs,
  initialBriefId,
}: {
  briefs: { id: string; title: string }[];
  initialBriefId?: string;
}) {
  const [briefId, setBriefId] = useState(
    initialBriefId && briefs.some((b) => b.id === initialBriefId) ? initialBriefId : '',
  );
  const [text, setText] = useState('');
  const [budget, setBudget] = useState('');
  const [results, setResults] = useState<MatchView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await gw<MatchView[]>('POST', '/ai/match', {
      ...(briefId ? { briefId } : { text }),
      ...(budget ? { budgetMaxUsd: Math.round(Number(budget)) } : {}),
    });
    setBusy(false);
    if (!r.data) return setError(r.error);
    setResults(r.data);
  }

  return (
    <div className="flex flex-col gap-5">
      {briefs.length > 0 && (
        <label className="flex flex-col gap-1.5 text-sm">
          Use one of your requests
          <select
            aria-label="Use one of your requests"
            value={briefId}
            onChange={(e) => setBriefId(e.target.value)}
            className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
          >
            <option value="">Describe a project instead</option>
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {!briefId && (
        <label className="flex flex-col gap-1.5 text-sm">
          Describe your project
          <textarea
            aria-label="Describe your project"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={3000}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
          />
        </label>
      )}
      <label className="flex max-w-xs flex-col gap-1.5 text-sm">
        Budget up to (USD, optional)
        <input
          aria-label="Budget up to (USD, optional)"
          type="number"
          min={1}
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg"
        />
      </label>
      <Button
        className="self-start"
        disabled={busy || (!briefId && text.trim().length < 20)}
        onClick={() => void run()}
      >
        {busy ? 'Matching…' : 'Find matches'}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      {results && results.length === 0 && (
        <p
          className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted"
          data-testid="no-matches"
        >
          No published seller matches these skills yet. Try describing the technologies you need.
        </p>
      )}
      {results && results.length > 0 && (
        <ol className="flex flex-col gap-3" data-testid="matches">
          {results.map((m, i) => (
            <li key={m.seller.id}>
              <Card className="flex flex-col gap-3" data-testid="match">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>
                    {i + 1}.{' '}
                    <Link className="hover:underline" href={`/u/${m.seller.slug}`}>
                      {m.seller.name}
                    </Link>
                  </CardTitle>
                  <Badge data-testid="match-score">{Math.round(m.score)} / 100</Badge>
                </div>
                {m.seller.headline && <p className="text-sm text-muted">{m.seller.headline}</p>}
                <p className="text-sm" data-testid="match-explanation">
                  {m.explanation}
                </p>
                <p className="text-xs text-muted">
                  {m.explainedBy === 'ai'
                    ? 'Explained by AI from the data below.'
                    : 'Summary of the data below.'}
                </p>
                <dl className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
                  {FACTOR_LABELS.map(([k, label]) => (
                    <div key={k}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="tabular-nums">{Math.round(m.factors[k].score * 100)}%</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
