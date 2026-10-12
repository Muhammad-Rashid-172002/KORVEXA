'use client';
import type { MeetingView } from '@glasswork/shared';
import { Alert } from '@glasswork/ui/components/alert';
import { Badge } from '@glasswork/ui/components/badge';
import { Button } from '@glasswork/ui/components/button';
import { Card, CardTitle } from '@glasswork/ui/components/card';
import { useState, type FormEvent } from 'react';
import { API_URL } from '@/lib/config';
import { gw } from '@/lib/gw';
import { useLoad } from '@/lib/use-load';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function MeetingCard({
  m,
  myId,
  reload,
  setMsg,
}: {
  m: MeetingView;
  myId: string;
  reload: () => Promise<void>;
  setMsg: (s: string | null) => void;
}) {
  const [notes, setNotes] = useState(m.notes ?? '');
  const mine = m.participants.find((p) => p.id === myId);
  const over = m.status === 'ended' || m.status === 'cancelled';

  async function act(path: string, method = 'POST', body?: unknown) {
    setMsg(null);
    const r = await gw(method, path, body);
    if (!r.ok) setMsg(r.error);
    await reload();
    return r;
  }
  async function join() {
    setMsg(null);
    const r = await gw<{ url: string }>('POST', `/meetings/${m.id}/join`);
    if (!r.data) return setMsg(r.error);
    window.location.assign(r.data.url);
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="meeting">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{m.title}</CardTitle>
          <p className="text-sm text-muted">
            {when(m.startsAt)} to {new Date(m.endsAt).toLocaleTimeString(undefined, { timeStyle: 'short' })} ·
            organised by {m.organizer.name}
          </p>
        </div>
        <Badge data-testid="meeting-status">{m.status}</Badge>
      </div>
      {m.agenda && <p className="whitespace-pre-wrap text-sm">{m.agenda}</p>}

      {m.recording.requested && (
        <div className="rounded-md border border-border p-3 text-sm" data-testid="recording-consent">
          <p className="font-medium">Recording</p>
          <p className="text-muted">
            This meeting is only recorded if <strong>everyone</strong> agrees. You can change your answer
            until it starts.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {m.participants.map((p) => (
              <li key={p.id}>
                <Badge>
                  {p.name}:{' '}
                  {p.consent === true ? 'agrees' : p.consent === false ? 'declined' : 'not answered'}
                </Badge>
              </li>
            ))}
          </ul>
          {m.status === 'scheduled' && mine && (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant={mine.consent === true ? 'primary' : 'secondary'}
                onClick={() => void act(`/meetings/${m.id}/consent`, 'PUT', { consent: true })}
              >
                I agree to recording
              </Button>
              <Button
                size="sm"
                variant={mine.consent === false ? 'primary' : 'secondary'}
                onClick={() => void act(`/meetings/${m.id}/consent`, 'PUT', { consent: false })}
              >
                I do not agree
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs" data-testid="recording-state">
            {m.recording.allConsented
              ? 'Everyone agreed: this meeting will be recorded.'
              : 'Not everyone agreed: this meeting will NOT be recorded.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {m.joinable && (
          <Button size="sm" onClick={() => void join()}>
            Join meeting
          </Button>
        )}
        {!over && (
          <Button asChild size="sm" variant="secondary">
            <a href={`${API_URL}/v1/meetings/${m.id}/ics`}>Add to calendar</a>
          </Button>
        )}
        {!over && m.organizer.id === myId && (
          <Button size="sm" variant="ghost" onClick={() => void act(`/meetings/${m.id}/cancel`)}>
            Cancel meeting
          </Button>
        )}
        {m.status === 'started' && (
          <Button size="sm" variant="ghost" onClick={() => void act(`/meetings/${m.id}/end`)}>
            Mark as ended
          </Button>
        )}
      </div>

      {m.status !== 'cancelled' && (
        <details>
          <summary className="cursor-pointer text-sm text-muted">Shared notes</summary>
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              aria-label={`Notes for ${m.title}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={20000}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
            <Button
              className="self-start"
              size="sm"
              variant="secondary"
              onClick={() => void act(`/meetings/${m.id}/notes`, 'PUT', { notes })}
            >
              Save notes
            </Button>
            <p className="text-xs text-muted">
              The seller can turn notes into board tasks from the Board tab.
            </p>
          </div>
        </details>
      )}
    </Card>
  );
}

export function Meetings({ projectId, myId }: { projectId: string; myId: string }) {
  const { data, reload } = useLoad<MeetingView[]>(`/projects/${projectId}/meetings`);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function schedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMsg(null);
    const r = await gw('POST', `/projects/${projectId}/meetings`, {
      title: String(f.get('title')).trim(),
      agenda: String(f.get('agenda') ?? '').trim() || null,
      startsAt: new Date(String(f.get('startsAt'))).toISOString(),
      durationMin: Number(f.get('durationMin')),
      recording: f.get('recording') === 'on',
    });
    setBusy(false);
    if (!r.ok) return setMsg(r.error);
    form.reset();
    await reload();
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const upcoming = data.filter((m) => m.status === 'scheduled' || m.status === 'started');
  const past = data.filter((m) => m.status === 'ended' || m.status === 'cancelled');
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-muted">
        Plan a video call with the other side. Both of you get a calendar invite. Recording is optional and
        needs everyone’s consent.
      </p>
      {msg && <Alert tone="danger">{msg}</Alert>}
      <Card className="flex flex-col gap-3">
        <CardTitle>Schedule a meeting</CardTitle>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={schedule}>
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Title
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              aria-label="Meeting title"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Starts
            <input
              name="startsAt"
              type="datetime-local"
              required
              aria-label="Meeting start"
              className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Length
            <select
              name="durationMin"
              defaultValue="30"
              aria-label="Meeting length"
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-fg"
            >
              {[15, 30, 45, 60, 90].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
            Agenda (optional)
            <textarea
              name="agenda"
              rows={2}
              maxLength={1500}
              aria-label="Meeting agenda"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="recording" />
            Ask everyone for consent to record this meeting
          </label>
          <Button type="submit" disabled={busy} className="self-start">
            {busy ? 'Scheduling…' : 'Schedule meeting'}
          </Button>
        </form>
      </Card>
      <section aria-label="Upcoming meetings" className="flex flex-col gap-3" data-testid="upcoming-meetings">
        <h3 className="text-sm font-semibold">Upcoming</h3>
        {upcoming.length === 0 && <p className="text-sm text-muted">Nothing scheduled.</p>}
        {upcoming.map((m) => (
          <MeetingCard
            key={`${m.id}-${m.status}-${m.notes}-${m.participants.map((p) => p.consent).join()}`}
            m={m}
            myId={myId}
            reload={reload}
            setMsg={setMsg}
          />
        ))}
      </section>
      {past.length > 0 && (
        <section aria-label="Past meetings" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Past</h3>
          {past.map((m) => (
            <MeetingCard key={m.id} m={m} myId={myId} reload={reload} setMsg={setMsg} />
          ))}
        </section>
      )}
    </div>
  );
}
