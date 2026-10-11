import { describe, expect, it } from 'vitest';
import { computeHealth, type HealthInput } from './room';
import { projectProgress } from './state-machines';

const now = new Date('2026-10-20T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = (over: Partial<HealthInput> = {}): HealthInput => ({
  projectStatus: 'active',
  projectCreatedAt: daysAgo(10),
  now,
  milestones: [
    { position: 1, status: 'in_progress', plannedDue: '2026-10-25', submittedAt: null, revisionCount: 0 },
    { position: 2, status: 'pending', plannedDue: '2026-11-05', submittedAt: null, revisionCount: 0 },
  ],
  ...over,
});

describe('computeHealth', () => {
  it('is on track when nothing is late or waiting', () => {
    expect(computeHealth(base())).toEqual({ health: 'on_track', reason: null });
  });

  it('is blocked when the project is paused, disputed, cancelled or cancellation was requested', () => {
    for (const status of ['paused', 'disputed', 'cancellation_requested', 'cancelled'] as const) {
      expect(computeHealth(base({ projectStatus: status })).health).toBe('blocked');
    }
  });

  it('is blocked when the next milestone is waiting for the buyer to fund it', () => {
    const r = computeHealth(
      base({
        milestones: [
          { position: 1, status: 'released', plannedDue: '2026-10-10', submittedAt: null, revisionCount: 0 },
          { position: 2, status: 'pending', plannedDue: '2026-10-30', submittedAt: null, revisionCount: 0 },
        ],
      }),
    );
    expect(r).toEqual({ health: 'blocked', reason: 'Waiting for the buyer to fund milestone 2' });
  });

  it('is at risk when an active milestone is past its planned date', () => {
    const r = computeHealth(
      base({
        milestones: [
          {
            position: 1,
            status: 'in_progress',
            plannedDue: '2026-10-19',
            submittedAt: null,
            revisionCount: 0,
          },
        ],
      }),
    );
    expect(r).toEqual({ health: 'at_risk', reason: 'Milestone 1 is past its planned date' });
  });

  it('is at risk when a submitted milestone has waited more than 3 days for review', () => {
    const r = computeHealth(
      base({
        milestones: [
          {
            position: 1,
            status: 'submitted',
            plannedDue: '2026-10-30',
            submittedAt: daysAgo(4),
            revisionCount: 0,
          },
        ],
      }),
    );
    expect(r.health).toBe('at_risk');
    expect(r.reason).toContain('waited 4 days');
    const fresh = computeHealth(
      base({
        milestones: [
          {
            position: 1,
            status: 'submitted',
            plannedDue: '2026-10-30',
            submittedAt: daysAgo(2),
            revisionCount: 0,
          },
        ],
      }),
    );
    expect(fresh.health).toBe('on_track');
  });

  it('flags repeated revision rounds', () => {
    const r = computeHealth(
      base({
        milestones: [
          {
            position: 1,
            status: 'revision_requested',
            plannedDue: '2026-10-30',
            submittedAt: null,
            revisionCount: 3,
          },
        ],
      }),
    );
    expect(r).toEqual({ health: 'at_risk', reason: 'Milestone 1 is on revision round 4' });
  });

  it('blocked wins over at_risk', () => {
    const r = computeHealth(
      base({
        milestones: [
          { position: 1, status: 'released', plannedDue: '2026-10-01', submittedAt: null, revisionCount: 0 },
          { position: 2, status: 'pending', plannedDue: '2026-10-02', submittedAt: null, revisionCount: 5 },
        ],
      }),
    );
    expect(r.health).toBe('blocked');
  });

  it('flags an order that has waited too long for funding or acceptance', () => {
    const ordered = (first: 'pending' | 'funded', age: number) =>
      computeHealth({
        projectStatus: 'requirements_submitted',
        projectCreatedAt: daysAgo(age),
        now,
        milestones: [{ position: 1, status: first, plannedDue: null, submittedAt: null, revisionCount: 0 }],
      });
    expect(ordered('pending', 1).health).toBe('on_track');
    expect(ordered('pending', 5).health).toBe('blocked');
    expect(ordered('funded', 5).health).toBe('at_risk');
  });

  it('completed projects are on track', () => {
    expect(computeHealth(base({ projectStatus: 'completed' })).health).toBe('on_track');
  });
});

describe('projectProgress with task completion', () => {
  const m = (
    amount: number,
    status: 'in_progress' | 'submitted' | 'released' | 'pending' | 'funded',
    ratio?: number,
  ) => ({
    amount: BigInt(amount),
    status,
    taskDoneRatio: ratio,
  });
  it('weights by amount and counts in-progress work by finished tasks (up to 60%)', () => {
    // 30/40/30: released + in_progress with half the tasks done + pending
    expect(
      projectProgress([m(30_000, 'released'), m(40_000, 'in_progress', 0.5), m(30_000, 'pending')]),
    ).toBe(42);
    // 30 + 40*0.8 (submitted) + 0
    expect(projectProgress([m(30_000, 'released'), m(40_000, 'submitted'), m(30_000, 'pending')])).toBe(62);
    expect(projectProgress([m(30_000, 'released'), m(40_000, 'released'), m(30_000, 'released')])).toBe(100);
    expect(projectProgress([m(30_000, 'funded'), m(40_000, 'pending'), m(30_000, 'pending')])).toBe(0);
  });
});
