import { MILESTONE_STATUSES, type MilestoneStatus } from '../enums';
import type { Machine } from './engine';

export type MilestoneEvent =
  | 'fund'
  | 'start'
  | 'submit'
  | 'request_revision'
  | 'approve'
  | 'auto_approve'
  | 'release'
  | 'cancel'
  | 'refund'
  | 'open_dispute'
  | 'resolve_release'
  | 'resolve_refund'
  | 'resolve_split';

/** Milestone lifecycle — docs/STATE_MACHINE.md §2. */
export const milestoneMachine: Machine<MilestoneStatus, MilestoneEvent> = {
  name: 'milestone',
  states: MILESTONE_STATUSES,
  initial: 'pending',
  terminal: ['released', 'cancelled', 'refunded'],
  transitions: [
    { event: 'fund', from: ['pending'], to: 'funded', actors: ['system'] },
    { event: 'start', from: ['funded'], to: 'in_progress', actors: ['seller', 'system'] },
    { event: 'submit', from: ['in_progress', 'revision_requested'], to: 'submitted', actors: ['seller'] },
    { event: 'request_revision', from: ['submitted'], to: 'revision_requested', actors: ['buyer'] },
    { event: 'approve', from: ['submitted'], to: 'approved', actors: ['buyer'] },
    { event: 'auto_approve', from: ['submitted'], to: 'approved', actors: ['system'] },
    { event: 'release', from: ['approved'], to: 'released', actors: ['system'] },
    { event: 'cancel', from: ['pending'], to: 'cancelled', actors: ['buyer', 'seller', 'admin'] },
    { event: 'refund', from: ['funded'], to: 'refunded', actors: ['system', 'admin'] },
    {
      event: 'open_dispute',
      from: ['in_progress', 'submitted', 'revision_requested'],
      to: 'disputed',
      actors: ['buyer', 'seller'],
    },
    { event: 'resolve_release', from: ['disputed'], to: 'released', actors: ['admin'] },
    { event: 'resolve_refund', from: ['disputed'], to: 'refunded', actors: ['admin'] },
    { event: 'resolve_split', from: ['disputed'], to: 'released', actors: ['admin'] },
  ],
};

/** Completion ratio per state for weighted progress (docs/STATE_MACHINE.md §3). */
export function milestoneCompletion(status: MilestoneStatus, taskDoneRatio = 0): number {
  switch (status) {
    case 'approved':
    case 'released':
      return 1;
    case 'submitted':
      return 0.8;
    case 'revision_requested':
      return 0.6;
    case 'in_progress':
      return Math.min(Math.max(taskDoneRatio, 0), 1) * 0.6;
    default:
      return 0;
  }
}

/** Weighted progress 0..100 where each milestone's weight is its amount (minor units). */
export function projectProgress(
  milestones: readonly { amount: bigint; status: MilestoneStatus; taskDoneRatio?: number }[],
): number {
  const active = milestones.filter((m) => m.status !== 'cancelled' && m.status !== 'refunded');
  const total = active.reduce((s, m) => s + Number(m.amount), 0);
  if (total === 0) return 0;
  const done = active.reduce((s, m) => s + Number(m.amount) * milestoneCompletion(m.status, m.taskDoneRatio), 0);
  return Math.round((done / total) * 1000) / 10;
}
