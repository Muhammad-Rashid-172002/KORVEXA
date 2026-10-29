'use client';
import { HelpCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Small "?" next to a word that might confuse a first-time visitor. Works with mouse, keyboard and touch: it is a
 * toggle button (not hover-only), closes on Escape or when focus leaves.
 */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <span
      ref={box}
      className="relative inline-flex align-middle"
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        <HelpCircle size={15} aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="glass absolute left-1/2 top-full z-40 mt-1.5 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-fg shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
