'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Toaster = dynamic(() => import('sonner').then((m) => m.Toaster), { ssr: false });

/** Sonner is only needed once something calls toast(); load it after the page is interactive. */
export function LazyToaster() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);
  return ready ? <Toaster position="bottom-right" closeButton /> : null;
}
