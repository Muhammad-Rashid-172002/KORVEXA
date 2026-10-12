'use client';
import type { MeetingView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card } from '@glasswork/ui/components/card';
import Link from 'next/link';
import { useState } from 'react';
import { API_URL } from '@/lib/config';
import { gw } from '@/lib/gw';

export function CallPanel({ meeting: m }: { meeting: MeetingView }) {
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ provider: string; recording: boolean } | null>(null);

  async function join() {
    setError(null);
    const r = await gw<{ url: string; provider: string; recording: boolean }>(
      'POST',
      `/meetings/${m.id}/join`,
    );
    if (!r.data) return setError(r.error);
    if (r.data.provider === 'stub') return setJoined({ provider: 'stub', recording: r.data.recording });
    window.location.assign(r.data.url);
  }

  return (
    <Card className="flex flex-col gap-4" data-testid="call-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{m.title}</h1>
          <p className="text-sm text-muted">
            {new Date(m.startsAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })} ·{' '}
            {m.participants.map((p) => p.name).join(', ')}
          </p>
        </div>
        <Badge>{m.status}</Badge>
      </div>
      {m.agenda && <p className="whitespace-pre-wrap text-sm">{m.agenda}</p>}
      {error && <Alert tone="danger">{error}</Alert>}
      {joined?.provider === 'stub' && (
        <Alert tone="info" data-testid="stub-call">
          Video calling is not connected on this environment yet. In production this button opens the secure
          video room.
          {joined.recording ? ' Everyone agreed to recording.' : ' This meeting is not recorded.'}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!m.joinable} onClick={() => void join()}>
          {m.joinable
            ? 'Join now'
            : m.status === 'cancelled'
              ? 'Cancelled'
              : m.status === 'ended'
                ? 'Ended'
                : 'Opens 15 minutes before the start'}
        </Button>
        {m.status !== 'cancelled' && m.status !== 'ended' && (
          <Button asChild variant="secondary">
            <a href={`${API_URL}/v1/meetings/${m.id}/ics`}>Add to calendar</a>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href={`/projects/${m.projectId}?tab=meetings`}>Back to the project</Link>
        </Button>
      </div>
    </Card>
  );
}
