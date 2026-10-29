'use client';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS = [
  { name: 'Design approved', who: 'Amara' },
  { name: 'First version ready', who: 'Amara' },
  { name: 'Final polish & launch', who: 'Amara' },
];
/** Overall progress shown at each stage of the loop. */
const STAGES = [8, 20, 33, 52, 66, 80, 100];

/**
 * Looping, screen-style demo of the Project Room so a visitor can SEE the main feature: the progress bar moves
 * as milestones are finished. Purely illustrative (labelled as such by the caller); static when the visitor
 * prefers reduced motion.
 */
export function LiveProgressDemo() {
  const [i, setI] = useState(0);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStill(true);
      setI(4);
      return;
    }
    const t = setInterval(() => setI((n) => (n + 1) % STAGES.length), 1700);
    return () => clearInterval(t);
  }, []);
  const pct = STAGES[i]!;
  const done = pct >= 100 ? 3 : pct >= 66 ? 2 : pct >= 33 ? 1 : 0;
  return (
    <div
      className="glass mx-auto w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
      data-testid="live-demo"
      data-still={still}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-danger/70" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
        <span className="ml-3 truncate text-xs text-muted">Your project · Online shop for my bakery</span>
      </div>
      <div className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Project progress</p>
            <p className="text-4xl font-semibold tabular-nums" aria-live="off">
              {pct}%
            </p>
          </div>
          <span className="rounded-full border border-success/50 px-2.5 py-1 text-xs text-success">
            {pct >= 100 ? 'Finished 🎉' : 'On track'}
          </span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="mt-5 flex flex-col gap-2">
          {STEPS.map((s, n) => {
            const isDone = n < done;
            const isNow = n === done;
            return (
              <li
                key={s.name}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-700 ${
                  isNow ? 'border-primary/60 bg-primary/10' : 'border-border'
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    isDone ? 'bg-success text-bg' : 'border border-border text-muted'
                  }`}
                >
                  {isDone ? <Check size={14} aria-hidden /> : n + 1}
                </span>
                <span className="flex-1">{s.name}</span>
                <span className="text-xs text-muted">
                  {isDone ? 'Approved & paid' : isNow ? `${s.who} is working` : 'Up next'}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">
          You only pay for a step when you approve it. Example for illustration, not a real project.
        </p>
      </div>
    </div>
  );
}
