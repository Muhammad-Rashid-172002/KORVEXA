import { describe, expect, it } from 'vitest';
import { buildIcs, foldIcsLine, isJoinable, renderGithubEvent } from './meetings';

const t = (s: string) => new Date(s);

describe('ICS', () => {
  const base = {
    uid: 'm-1@glasswork',
    title: 'Kickoff, scope; review',
    description: 'Line one\nLine two',
    startsAt: t('2026-11-02T14:00:00Z'),
    endsAt: t('2026-11-02T14:30:00Z'),
    url: 'https://app.test/meetings/1',
    organizer: { name: 'Sam Seller', email: 'sam@example.test' },
    attendees: [{ name: 'Bea Buyer', email: 'bea@example.test' }],
    now: t('2026-10-30T09:00:00Z'),
  };
  it('produces a valid CRLF calendar with UTC times and escaped text', () => {
    const ics = buildIcs(base).replace(/\r\n /g, ''); // unfold continuation lines
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261102T140000Z\r\n');
    expect(ics).toContain('DTEND:20261102T143000Z\r\n');
    expect(ics).toContain('SUMMARY:Kickoff\\, scope\\; review\r\n');
    expect(ics).toContain('DESCRIPTION:Line one\\nLine two\r\n');
    expect(ics).toContain(
      'ATTENDEE;CN=Bea Buyer;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:bea@example.test',
    );
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('TRIGGER:-PT15M');
  });
  it('marks cancellations', () => {
    const ics = buildIcs({ ...base, cancelled: true, sequence: 1 });
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SEQUENCE:1');
  });
  it('folds long lines at 75 octets without splitting characters', () => {
    const long = `DESCRIPTION:${'é'.repeat(80)}`;
    const folded = foldIcsLine(long);
    for (const part of folded.split('\r\n'))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
  });
});

describe('join window', () => {
  const m = {
    status: 'scheduled' as const,
    startsAt: t('2026-11-02T14:00:00Z'),
    endsAt: t('2026-11-02T14:30:00Z'),
  };
  it('opens 15 minutes early and closes an hour after the end', () => {
    expect(isJoinable(m, t('2026-11-02T13:40:00Z'))).toBe(false);
    expect(isJoinable(m, t('2026-11-02T13:46:00Z'))).toBe(true);
    expect(isJoinable(m, t('2026-11-02T15:29:00Z'))).toBe(true);
    expect(isJoinable(m, t('2026-11-02T15:31:00Z'))).toBe(false);
  });
  it('is never joinable once cancelled or ended', () => {
    expect(isJoinable({ ...m, status: 'cancelled' }, t('2026-11-02T14:05:00Z'))).toBe(false);
    expect(isJoinable({ ...m, status: 'ended' }, t('2026-11-02T14:05:00Z'))).toBe(false);
  });
});

describe('GitHub events in plain language', () => {
  it('summarises pushes', () => {
    const one = renderGithubEvent('push', {
      ref: 'refs/heads/main',
      pusher: { name: 'sam' },
      commits: [{ message: 'Add login page\n\nlong body', timestamp: '2026-11-01T10:00:00Z' }],
      compare: 'https://github.com/o/r/compare/a...b',
    });
    expect(one).toMatchObject({
      kind: 'commits',
      title: 'sam saved a change to main: Add login page',
      actor: 'sam',
    });
    const many = renderGithubEvent('push', {
      ref: 'refs/heads/feature/x',
      pusher: { name: 'sam' },
      commits: [{ message: 'a' }, { message: 'Fix the footer' }, { message: 'c' }],
    });
    expect(many?.title).toBe('sam saved 3 changes to feature/x');
    expect(many?.detail).toBe('Latest: c');
  });
  it('ignores empty and deleting pushes', () => {
    expect(renderGithubEvent('push', { ref: 'refs/heads/x', commits: [] })).toBeNull();
    expect(renderGithubEvent('push', { deleted: true, commits: [{ message: 'x' }] })).toBeNull();
  });
  it('describes pull requests by what they mean for the client', () => {
    const open = renderGithubEvent('pull_request', {
      action: 'opened',
      pull_request: { title: 'Checkout flow', user: { login: 'sam' }, html_url: 'https://x/1' },
    });
    expect(open).toMatchObject({
      kind: 'pull_request',
      title: 'Ready for review: Checkout flow',
      actor: 'sam',
    });
    const merged = renderGithubEvent('pull_request', {
      action: 'closed',
      pull_request: {
        title: 'Checkout flow',
        merged: true,
        changed_files: 4,
        merged_at: '2026-11-01T12:00:00Z',
        user: { login: 'sam' },
      },
    });
    expect(merged).toMatchObject({
      title: 'Merged into the main code: Checkout flow',
      detail: '4 files changed',
    });
    expect(
      renderGithubEvent('pull_request', { action: 'closed', pull_request: { title: 'Nope', merged: false } })
        ?.title,
    ).toBe('Closed without merging: Nope');
    expect(renderGithubEvent('pull_request', { action: 'labeled', pull_request: { title: 'x' } })).toBeNull();
  });
  it('reports only final deployment states', () => {
    const ok = renderGithubEvent('deployment_status', {
      deployment: { environment: 'production' },
      deployment_status: { state: 'success', environment_url: 'https://site.test' },
    });
    expect(ok).toMatchObject({
      kind: 'deployment',
      title: 'Deployed to the live site',
      url: 'https://site.test',
    });
    expect(
      renderGithubEvent('deployment_status', {
        deployment: { environment: 'staging' },
        deployment_status: { state: 'failure' },
      })?.title,
    ).toBe('Deployment to staging failed');
    expect(
      renderGithubEvent('deployment_status', {
        deployment: { environment: 'production' },
        deployment_status: { state: 'in_progress' },
      }),
    ).toBeNull();
  });
  it('ignores unknown events and malformed payloads without throwing', () => {
    expect(renderGithubEvent('ping', { zen: 'hi' })).toBeNull();
    expect(renderGithubEvent('push', null)).toBeNull();
    expect(renderGithubEvent('pull_request', 'garbage')).toBeNull();
  });
});
