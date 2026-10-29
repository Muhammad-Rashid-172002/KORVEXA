'use client';
import { Progress } from '@glasswork/ui/components/progress';
import { Check, Circle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { gw } from '@/lib/gw';

export interface ChecklistItem {
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

/** "Getting started" card with real progress computed from the account's data. Hides itself when finished or dismissed. */
export function GettingStarted({
  title,
  items,
  hidden,
}: {
  title: string;
  items: ChecklistItem[];
  hidden: boolean;
}) {
  const [gone, setGone] = useState(hidden);
  const doneCount = items.filter((i) => i.done).length;
  if (gone || doneCount === items.length) return null;
  const next = items.find((i) => !i.done);
  return (
    <section
      aria-labelledby="getting-started"
      className="glass flex flex-col gap-4 rounded-2xl p-5"
      data-testid="getting-started"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="getting-started" className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted">
            {doneCount} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          className="cursor-pointer text-xs text-muted underline-offset-4 hover:underline"
          onClick={() => {
            setGone(true);
            void gw('PATCH', '/me/onboarding', { checklistHidden: true });
          }}
        >
          Hide
        </button>
      </div>
      <Progress value={Math.round((doneCount / items.length) * 100)} label="Getting started progress" />
      <ol className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.label}>
            <Link
              href={it.href}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm no-underline transition-colors hover:border-primary ${
                it === next ? 'border-primary/60 bg-primary/10' : 'border-border'
              }`}
            >
              {it.done ? (
                <Check size={18} className="mt-0.5 shrink-0 text-success" aria-label="Done" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-muted" aria-label="Not done yet" />
              )}
              <span>
                <span className={it.done ? 'text-muted line-through' : 'font-medium'}>{it.label}</span>
                {!it.done && <span className="block text-xs text-muted">{it.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
