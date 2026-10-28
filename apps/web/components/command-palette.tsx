'use client';
import { Search } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const PaletteDialog = dynamic(() => import('./command-palette-dialog'), { ssr: false });

/** ⌘K / Ctrl+K quick navigation. Pure navigation: authorisation is still enforced by the server. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setLoaded(true);
        setOpen((o) => !o);
      }
    };
    const onOpen = () => {
      setLoaded(true);
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('gw:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('gw:open-palette', onOpen);
    };
  }, []);

  return loaded ? <PaletteDialog open={open} onOpenChange={setOpen} /> : null;
}

export function PaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('gw:open-palette'))}
      aria-label="Open quick navigation"
      className="hidden h-8 cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-xs text-muted hover:text-fg md:flex"
    >
      <Search size={14} aria-hidden /> Search
      <kbd className="rounded border border-border px-1 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
