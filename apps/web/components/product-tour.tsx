'use client';
import { Button } from '@glasswork/ui/components/button';
import { Dialog, DialogContent } from '@glasswork/ui/components/dialog';
import { useEffect, useState } from 'react';
import { gw } from '@/lib/gw';

export interface TourStep {
  title: string;
  body: string;
}

/**
 * Short, skippable walkthrough shown once per user per area (stored on the server, so it does not come back on
 * another device). `done` comes from the server render, so a finished tour never flashes.
 */
export function ProductTour({
  tour,
  steps,
  done,
}: {
  tour: 'buyer' | 'seller' | 'room';
  steps: TourStep[];
  done: boolean;
}) {
  const [open, setOpen] = useState(!done);
  const [i, setI] = useState(0);
  // Automated browsers skip tours so they never cover the page under test; the tour's own tests opt back in.
  useEffect(() => {
    if (navigator.webdriver && !document.cookie.includes('gw-show-tour=1')) setOpen(false);
  }, []);
  const last = i === steps.length - 1;
  const step = steps[i]!;

  function close() {
    setOpen(false);
    void gw('PATCH', '/me/onboarding', { tours: { [tour]: true } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={step.title}
        description={`Quick tour · ${i + 1} of ${steps.length}`}
        data-testid="product-tour"
      >
        <p className="text-sm">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            Skip tour
          </Button>
          <div className="flex gap-2">
            {i > 0 && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setI(i - 1)}>
                Back
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => (last ? close() : setI(i + 1))}>
              {last ? 'Got it' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
