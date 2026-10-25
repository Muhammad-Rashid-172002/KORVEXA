'use client';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from '@/components/field';
import { API_URL } from '@/lib/config';
import { gw } from '@/lib/gw';

/** Data export and account deletion (brief §11). */
export function DataPanel({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setError(null);
    const r = await gw<{ canDelete: boolean; reasons: string[] }>('GET', '/me/delete-check');
    if (!r.data) return setError(r.error ?? 'Could not check your account.');
    setReasons(r.data.reasons);
    setOpen(true);
  }
  async function remove() {
    setBusy(true);
    const r = await gw('POST', '/me/delete', { confirmEmail: confirm });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'Could not delete the account.');
    router.push('/');
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="data-panel">
      <CardTitle>Your data</CardTitle>
      <CardDescription>
        Download everything we hold about you as a JSON file, or delete your account. Deleting removes your
        profile, listings, sign-in methods and saved items. Payment records, invoices and the history of
        projects you shared with other people are kept, without your name.
      </CardDescription>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <a href={`${API_URL}/v1/me/export`} download>
            Download my data
          </a>
        </Button>
        <Button variant="secondary" onClick={start} data-testid="delete-account-start">
          Delete my account…
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {open && reasons.length > 0 && (
        <Alert tone="danger">
          <p className="font-medium">You can’t delete your account yet:</p>
          <ul className="list-disc pl-5">
            {reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Alert>
      )}
      {open && reasons.length === 0 && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void remove();
          }}
        >
          <Alert tone="danger">This cannot be undone. Type your email ({email}) to confirm.</Alert>
          <Field
            id="confirm-email"
            label="Your email"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <Button type="submit" variant="danger" disabled={busy || confirm.length < 3}>
            {busy ? 'Deleting…' : 'Permanently delete my account'}
          </Button>
        </form>
      )}
    </Card>
  );
}
