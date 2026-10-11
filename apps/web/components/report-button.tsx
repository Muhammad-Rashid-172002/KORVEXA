'use client';
import type { ReportTarget } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { gw } from '@/lib/gw';

const REASONS = [
  'Spam or scam',
  'Misleading or false information',
  'Harassment or abuse',
  'Off-platform payment request',
  'Inappropriate content',
  'Other',
];

export function ReportButton({
  targetType,
  targetId,
  label = 'Report',
  next,
}: {
  targetType: ReportTarget;
  targetId: string;
  label?: string;
  next: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await gw('POST', '/reports', {
      targetType,
      targetId,
      reason: String(f.get('reason')),
      details: String(f.get('details') ?? '').trim() || undefined,
    });
    if (r.status === 401) return router.push(`/login?next=${encodeURIComponent(next)}`);
    setMsg(
      r.ok
        ? { tone: 'success', text: 'Thanks. Our team will review your report.' }
        : { tone: 'danger', text: r.error ?? 'Could not send the report' },
    );
    if (r.ok) setOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 self-start text-xs text-muted hover:text-fg"
      >
        <Flag size={12} aria-hidden /> {label}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="flex max-w-md flex-col gap-2 rounded-lg border border-border bg-surface p-3"
          data-testid="report-form"
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Reason
            <select name="reason" className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-fg">
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Details (optional)
            <textarea
              name="details"
              rows={2}
              maxLength={2000}
              className="rounded-md border border-border bg-bg px-2 py-1 text-sm text-fg"
            />
          </label>
          <Button size="sm" type="submit" className="self-start">
            Send report
          </Button>
        </form>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
