'use client';
import { brand } from '@glasswork/shared/brand';
import { Alert } from '@glasswork/ui/components/alert';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardDescription, CardTitle } from '@glasswork/ui/components/card';
import { useEffect, useState } from 'react';
import { gw } from '@/lib/gw';
import type { Pref } from './page';

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type PushState = 'checking' | 'unsupported' | 'not-configured' | 'off' | 'on' | 'denied';

export function PreferencesForm({ initial }: { initial: Pref[] }) {
  const [prefs, setPrefs] = useState(initial);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [push, setPush] = useState<PushState>('checking');

  useEffect(() => {
    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setPush('unsupported');
      const key = await gw<{ enabled: boolean }>('GET', '/push/public-key');
      if (!key.data?.enabled) return setPush('not-configured');
      if (Notification.permission === 'denied') return setPush('denied');
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      setPush((await reg?.pushManager.getSubscription()) ? 'on' : 'off');
    })();
  }, []);

  async function enablePush() {
    const key = await gw<{ publicKey: string }>('GET', '/push/public-key');
    if (!key.data?.publicKey) return;
    if ((await Notification.requestPermission()) !== 'granted') return setPush('denied');
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToBytes(key.data.publicKey),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await gw('POST', '/me/push-subscriptions', { endpoint: json.endpoint, keys: json.keys });
    setPush(r.ok ? 'on' : 'off');
    if (!r.ok) setMsg({ tone: 'danger', text: r.error ?? 'Could not enable push notifications' });
  }
  async function disablePush() {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await gw('DELETE', '/me/push-subscriptions', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setPush('off');
  }

  const set = (type: string, field: 'inApp' | 'email' | 'push', value: boolean) =>
    setPrefs((p) => p.map((x) => (x.type === type ? { ...x, [field]: value } : x)));

  async function save() {
    const r = await gw('PUT', '/me/notification-preferences', {
      prefs: prefs.map(({ type, inApp, email, push: pu }) => ({ type, inApp, email, push: pu })),
    });
    setMsg(
      r.ok ? { tone: 'success', text: 'Preferences saved.' } : { tone: 'danger', text: r.error ?? 'Failed' },
    );
  }

  return (
    <>
      <Card className="flex flex-col gap-2">
        <CardTitle>Browser push</CardTitle>
        <CardDescription>
          Get alerts even when {brand.productName} is closed. Choose which events push below.
        </CardDescription>
        {push === 'checking' && <p className="text-sm text-muted">Checking…</p>}
        {push === 'unsupported' && (
          <p className="text-sm text-muted">This browser does not support web push.</p>
        )}
        {push === 'not-configured' && (
          <p className="text-sm text-muted">
            Push is not configured on this server yet (it needs VAPID keys).
          </p>
        )}
        {push === 'denied' && (
          <p className="text-sm text-muted">
            Notifications are blocked for this site in your browser settings.
          </p>
        )}
        {push === 'off' && (
          <Button className="self-start" onClick={() => void enablePush()}>
            Enable push on this device
          </Button>
        )}
        {push === 'on' && (
          <Button className="self-start" variant="secondary" onClick={() => void disablePush()}>
            Turn off push on this device
          </Button>
        )}
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm" data-testid="prefs-table">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">In-app</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Push</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {prefs.map((p) => (
              <tr key={p.type}>
                <td className="px-3 py-2">{p.label}</td>
                {(['inApp', 'email', 'push'] as const).map((f) => (
                  <td key={f} className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={p[f]}
                      onChange={(e) => set(p.type, f, e.target.checked)}
                      aria-label={`${p.label}: ${f === 'inApp' ? 'in-app' : f}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button className="self-start" onClick={() => void save()}>
        Save preferences
      </Button>
    </>
  );
}
