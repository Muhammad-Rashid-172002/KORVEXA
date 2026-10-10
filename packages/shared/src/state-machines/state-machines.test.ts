import { describe, expect, it } from 'vitest';
import { MILESTONE_STATUSES, PROJECT_STATUSES } from '../enums';
import { availableEvents, InvalidTransitionError, transition } from './engine';
import { milestoneMachine, projectProgress } from './milestone';
import { projectMachine } from './project';

describe.each([
  ['project', projectMachine, PROJECT_STATUSES],
  ['milestone', milestoneMachine, MILESTONE_STATUSES],
] as const)('%s machine integrity', (_name, machine, allStates) => {
  it('only references declared states', () => {
    for (const t of machine.transitions) {
      expect(allStates).toContain(t.to);
      for (const f of t.from) expect(allStates).toContain(f);
    }
  });
  it('every non-initial state is reachable and every non-terminal state has an exit', () => {
    const targets = new Set(machine.transitions.map((t) => t.to));
    const sources = new Set(machine.transitions.flatMap((t) => [...t.from]));
    for (const s of allStates) {
      if (s !== machine.initial) expect(targets.has(s), `${s} unreachable`).toBe(true);
      if (!machine.terminal.includes(s as never)) expect(sources.has(s), `${s} is a dead end`).toBe(true);
    }
  });
  it('terminal states have no outgoing transitions', () => {
    for (const t of machine.transitions) for (const f of t.from) expect(machine.terminal).not.toContain(f);
  });
});

describe('milestone transitions', () => {
  it('runs the happy path with revisions', () => {
    let s = milestoneMachine.initial;
    s = transition(milestoneMachine, s, 'fund', 'system');
    s = transition(milestoneMachine, s, 'start', 'seller');
    s = transition(milestoneMachine, s, 'submit', 'seller');
    s = transition(milestoneMachine, s, 'request_revision', 'buyer');
    s = transition(milestoneMachine, s, 'submit', 'seller');
    s = transition(milestoneMachine, s, 'approve', 'buyer');
    s = transition(milestoneMachine, s, 'release', 'system');
    expect(s).toBe('released');
  });
  it('rejects a seller approving their own work', () => {
    expect(() => transition(milestoneMachine, 'submitted', 'approve', 'seller')).toThrow(InvalidTransitionError);
  });
  it('rejects client-triggered funding (only payment webhooks fund)', () => {
    expect(() => transition(milestoneMachine, 'pending', 'fund', 'buyer')).toThrow(InvalidTransitionError);
  });
  it('rejects releasing unapproved work', () => {
    expect(() => transition(milestoneMachine, 'submitted', 'release', 'system')).toThrow(InvalidTransitionError);
  });
  it('lists buyer actions on a submitted milestone', () => {
    expect(availableEvents(milestoneMachine, 'submitted', 'buyer').sort()).toEqual(
      ['approve', 'open_dispute', 'request_revision'].sort(),
    );
  });
});

describe('project transitions', () => {
  it('cannot complete from draft', () => {
    expect(() => transition(projectMachine, 'draft', 'complete', 'system')).toThrow(InvalidTransitionError);
  });
  it('only admins resolve disputes', () => {
    expect(() => transition(projectMachine, 'disputed', 'resolve_dispute', 'buyer')).toThrow();
    expect(transition(projectMachine, 'disputed', 'resolve_dispute', 'admin')).toBe('resolved');
  });
});

describe('projectProgress', () => {
  it('weights by milestone amount', () => {
    expect(
      projectProgress([
        { amount: 10_000n, status: 'released' },
        { amount: 30_000n, status: 'pending' },
      ]),
    ).toBe(25);
  });
  it('ignores cancelled/refunded milestones and handles empty input', () => {
    expect(projectProgress([])).toBe(0);
    expect(projectProgress([{ amount: 5n, status: 'refunded' }])).toBe(0);
    expect(projectProgress([{ amount: 5n, status: 'approved' }, { amount: 5n, status: 'cancelled' }])).toBe(100);
  });
});
