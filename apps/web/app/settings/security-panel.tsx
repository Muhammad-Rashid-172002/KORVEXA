'use client';
import type { SessionView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field } from '@/components/field';
import { authClient } from '@/lib/auth-client';
import { gw } from '@/lib/gw';

export function SecurityPanel({
  sessions,
  twoFactorEnabled,
}: {
  sessions: SessionView[];
  twoFactorEnabled: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [setup, setSetup] = useState<{ uri: string; backupCodes: string[] } | null>(null);

  async function revoke(id: string) {
    const r = await gw('DELETE', `/me/sessions/${id}`);
    if (!r.ok) setMsg({ tone: 'danger', text: r.error ?? 'Failed' });
    router.refresh();
  }
  async function revokeOthers() {
    await gw('POST', '/me/sessions/revoke-others');
    setMsg({ tone: 'success', text: 'Signed out of all other devices.' });
    router.refresh();
  }
  async function signOutEverywhere() {
    await gw('POST', '/me/sessions/revoke-all');
    router.push('/login');
    router.refresh();
  }

  async function startTwoFactor(password: string) {
    const { data, error } = await authClient.twoFactor.enable({ password });
    if (error || !data || data.method !== 'totp')
      return setMsg({ tone: 'danger', text: 'Could not start 2FA. Check your password.' });
    setSetup({ uri: data.totpURI, backupCodes: data.backupCodes });
  }
  async function confirmTwoFactor(code: string) {
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) return setMsg({ tone: 'danger', text: 'That code is not valid.' });
    setSetup(null);
    setMsg({ tone: 'success', text: 'Two-factor authentication is on.' });
    router.refresh();
  }
  async function disableTwoFactor(password: string) {
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) return setMsg({ tone: 'danger', text: 'Could not disable 2FA. Check your password.' });
    setMsg({ tone: 'success', text: 'Two-factor authentication is off.' });
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Security</CardTitle>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <section className="flex flex-col gap-2" aria-labelledby="sessions-h">
        <h2 id="sessions-h" className="text-sm font-medium">
          Active sessions
        </h2>
        <ul
          className="flex flex-col divide-y divide-border rounded-md border border-border"
          data-testid="session-list"
        >
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{describeDevice(s.userAgent)}</span>
                <span className="text-xs text-muted">
                  {s.ipAddress ?? 'unknown IP'} · since{' '}
                  <time suppressHydrationWarning>{new Date(s.createdAt).toLocaleString()}</time>
                </span>
              </span>
              {s.current ? (
                <Badge>this device</Badge>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void revoke(s.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void revokeOthers()}>
            Sign out other devices
          </Button>
          <Button size="sm" variant="danger" onClick={() => void signOutEverywhere()}>
            Log out everywhere
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="2fa-h">
        <h2 id="2fa-h" className="text-sm font-medium">
          Two-factor authentication (authenticator app)
        </h2>
        {setup ? (
          <div className="flex flex-col gap-3">
            <CardDescription>
              Add this key to your authenticator app, then enter the 6-digit code. Save your backup codes
              somewhere safe; they are shown only once.
            </CardDescription>
            <code className="break-all rounded-md bg-surface-2 p-2 text-xs" data-testid="totp-uri">
              {setup.uri}
            </code>
            <code className="rounded-md bg-surface-2 p-2 text-xs">{setup.backupCodes.join('  ')}</code>
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void confirmTwoFactor(String(new FormData(e.currentTarget).get('code')));
              }}
            >
              <Field
                id="code"
                label="6-digit code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <Button type="submit">Confirm</Button>
            </form>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const pw = String(new FormData(e.currentTarget).get('password'));
              void (twoFactorEnabled ? disableTwoFactor(pw) : startTwoFactor(pw));
            }}
          >
            <Field
              id="password"
              label="Confirm password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Button type="submit" variant={twoFactorEnabled ? 'danger' : 'primary'}>
              {twoFactorEnabled ? 'Turn off 2FA' : 'Turn on 2FA'}
            </Button>
          </form>
        )}
      </section>
    </Card>
  );
}

/** "Chrome on Windows" instead of a 150-character user-agent string. */
function describeDevice(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'unknown system';
  return `${browser} on ${os}`;
}
