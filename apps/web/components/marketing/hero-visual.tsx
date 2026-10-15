'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const HeroScene = dynamic(() => import('./hero-scene'), { ssr: false });

function canRun3D(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (window.innerWidth < 640) return false; // mobile gets the poster only: battery and LCP
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

const STEPS = ['Requirements', 'Design', 'Build', 'Launch'];

/**
 * Poster first: the static poster is server-rendered, so LCP never waits for three.js. The 3D scene loads only
 * after idle, only when motion is allowed and WebGL exists, and fades the poster out once it is drawing.
 */
export function HeroVisual() {
  const [run, setRun] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canRun3D()) return;
    const start = () => setRun(true);
    if ('requestIdleCallback' in window) {
      const h = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(h);
    }
    const t = setTimeout(start, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="relative h-[260px] w-full sm:h-[420px]"
      data-testid="hero-visual"
      data-3d={ready ? 'on' : 'off'}
    >
      <Poster hidden={ready} />
      {run ? <HeroScene onReady={() => setReady(true)} /> : null}
    </div>
  );
}

/** Static poster of the same composition: four milestone panes, the first three done. */
function Poster({ hidden }: { hidden: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center gap-3 transition-opacity duration-700 sm:gap-5 ${hidden ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden={hidden}
    >
      {STEPS.map((s, i) => {
        const done = i < 2;
        const active = i === 2;
        return (
          <div
            key={s}
            className={`glass w-1/5 min-w-[68px] max-w-[190px] -skew-y-3 rounded-xl p-3 sm:p-4 ${done ? 'border-primary/50 bg-primary/15' : ''} ${active ? 'border-primary/60 shadow-[0_0_40px_-8px_var(--gw-glow)]' : ''}`}
            style={{ translate: `0 ${i % 2 === 0 ? -6 : 6}px` }}
          >
            <div className="h-1.5 w-2/3 rounded bg-border" />
            <div className="mt-2 h-1.5 w-full rounded bg-border" />
            <p className="mt-4 text-[10px] text-muted sm:text-xs">{s}</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-border">
              <div className="h-full bg-primary" style={{ width: done ? '100%' : active ? '55%' : '0%' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
