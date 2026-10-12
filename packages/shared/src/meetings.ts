import { z } from 'zod';

export const MEETING_STATUSES = ['scheduled', 'started', 'ended', 'cancelled'] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const meetingInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  agenda: z.string().trim().max(1500).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(15).max(180).default(30),
  /** Asks every participant for consent to record. Recording only ever starts when ALL have agreed. */
  recording: z.boolean().default(false),
});
export type MeetingInput = z.infer<typeof meetingInputSchema>;

export const consentSchema = z.object({ consent: z.boolean() });
export const meetingNotesInputSchema = z.object({ notes: z.string().trim().max(20_000) });

export interface MeetingView {
  id: string;
  projectId: string;
  title: string;
  agenda: string | null;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  organizer: { id: string; name: string };
  provider: string;
  /** Participants who may join, with their consent state when recording was requested. */
  participants: { id: string; name: string; consent: boolean | null }[];
  recording: { requested: boolean; allConsented: boolean };
  notes: string | null;
  /** Whether "Join" is available right now (from 15 minutes before the start until an hour after the end). */
  joinable: boolean;
}

export const JOIN_EARLY_MS = 15 * 60_000;
export const JOIN_LATE_MS = 60 * 60_000;
export function isJoinable(
  m: { status: MeetingStatus; startsAt: Date; endsAt: Date },
  now = new Date(),
): boolean {
  if (m.status === 'cancelled' || m.status === 'ended') return false;
  return (
    now.getTime() >= m.startsAt.getTime() - JOIN_EARLY_MS &&
    now.getTime() <= m.endsAt.getTime() + JOIN_LATE_MS
  );
}

// ---- ICS (RFC 5545) ------------------------------------------------------------------------

const icsEscape = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Folds a content line to 75 octets per RFC 5545 §3.1 (continuation lines start with one space). */
export function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74; // the leading space of a continuation line counts
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export interface IcsInput {
  uid: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  url?: string;
  organizer: { name: string; email: string };
  attendees: { name: string; email: string }[];
  cancelled?: boolean;
  sequence?: number;
  now?: Date;
}

export function buildIcs(i: IcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KorvenzaTech//Glasswork//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${i.cancelled ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${i.uid}`,
    `DTSTAMP:${icsDate(i.now ?? new Date())}`,
    `DTSTART:${icsDate(i.startsAt)}`,
    `DTEND:${icsDate(i.endsAt)}`,
    `SEQUENCE:${i.sequence ?? 0}`,
    `STATUS:${i.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    `SUMMARY:${icsEscape(i.title)}`,
    ...(i.description ? [`DESCRIPTION:${icsEscape(i.description)}`] : []),
    ...(i.url ? [`URL:${i.url}`] : []),
    `ORGANIZER;CN=${icsEscape(i.organizer.name)}:mailto:${i.organizer.email}`,
    ...i.attendees.map(
      (a) => `ATTENDEE;CN=${icsEscape(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${a.email}`,
    ),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(i.title)}`,
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

// ---- GitHub activity in plain language -----------------------------------------------------

export const CODE_EVENT_KINDS = ['commits', 'pull_request', 'deployment'] as const;
export type CodeEventKind = (typeof CODE_EVENT_KINDS)[number];

export const repoSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/, 'Use the form owner/repository');
export const codeLinkInputSchema = z.object({ repo: repoSchema });

export interface CodeEventView {
  id: string;
  kind: CodeEventKind;
  title: string;
  detail: string | null;
  url: string | null;
  actor: string | null;
  repo: string;
  occurredAt: string;
}
export interface CodeLinkView {
  id: string;
  repo: string;
  createdAt: string;
}

export interface RenderedEvent {
  kind: CodeEventKind;
  title: string;
  detail: string | null;
  url: string | null;
  actor: string | null;
  occurredAt: Date;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Turns a GitHub webhook into one plain-language line a non-developer can read. Returns null for events
 * we deliberately ignore (pings, label changes, branch deletes, intermediate deployment states…).
 */
export function renderGithubEvent(event: string, payload: unknown, now = new Date()): RenderedEvent | null {
  const p = obj(payload);
  const repoUrl = str(obj(p.repository).html_url);
  if (event === 'push') {
    if (p.deleted === true) return null;
    const commits = Array.isArray(p.commits) ? p.commits.map(obj) : [];
    if (commits.length === 0) return null;
    const ref = str(p.ref) ?? '';
    const branch = ref.replace(/^refs\/heads\//, '');
    const actor = str(obj(p.pusher).name) ?? str(obj(p.sender).login);
    const last = commits.at(-1)!;
    const first = str(obj(commits[0]).message)?.split('\n')[0] ?? '';
    const lastMsg = str(last.message)?.split('\n')[0] ?? '';
    const detail = commits.length === 1 ? null : `Latest: ${clip(lastMsg, 100)}`;
    return {
      kind: 'commits',
      title:
        commits.length === 1
          ? `${actor ?? 'The developer'} saved a change to ${branch}: ${clip(first, 100)}`
          : `${actor ?? 'The developer'} saved ${plural(commits.length, 'change')} to ${branch}`,
      detail,
      url: str(p.compare) ?? repoUrl,
      actor,
      occurredAt: new Date(str(last.timestamp) ?? now),
    };
  }
  if (event === 'pull_request') {
    const pr = obj(p.pull_request);
    const title = clip(str(pr.title) ?? 'a change', 100);
    const action = str(p.action);
    const actor = str(obj(pr.user).login) ?? str(obj(p.sender).login);
    const url = str(pr.html_url);
    const at = new Date(str(pr.updated_at) ?? now);
    if (action === 'opened' || action === 'ready_for_review')
      return {
        kind: 'pull_request',
        title: `Ready for review: ${title}`,
        detail: pr.draft === true ? 'Draft' : null,
        url,
        actor,
        occurredAt: at,
      };
    if (action === 'closed' && pr.merged === true) {
      const files = typeof pr.changed_files === 'number' ? pr.changed_files : null;
      return {
        kind: 'pull_request',
        title: `Merged into the main code: ${title}`,
        detail: files === null ? null : `${plural(files, 'file')} changed`,
        url,
        actor,
        occurredAt: new Date(str(pr.merged_at) ?? at),
      };
    }
    if (action === 'closed')
      return {
        kind: 'pull_request',
        title: `Closed without merging: ${title}`,
        detail: null,
        url,
        actor,
        occurredAt: at,
      };
    return null;
  }
  if (event === 'deployment_status') {
    const ds = obj(p.deployment_status);
    const state = str(ds.state);
    if (state !== 'success' && state !== 'failure' && state !== 'error') return null; // skip pending / in_progress noise
    const env = str(obj(p.deployment).environment) ?? 'an environment';
    const pretty = env.toLowerCase() === 'production' ? 'the live site' : env;
    return {
      kind: 'deployment',
      title: state === 'success' ? `Deployed to ${pretty}` : `Deployment to ${pretty} failed`,
      detail: str(ds.description),
      url: str(ds.environment_url) ?? str(ds.target_url),
      actor: str(obj(ds.creator).login),
      occurredAt: new Date(str(ds.created_at) ?? now),
    };
  }
  return null;
}

/** GitHub signs the raw body: `sha256=<hex hmac>`. Compared in constant time by the caller. */
export const GITHUB_SIGNATURE_PREFIX = 'sha256=';
