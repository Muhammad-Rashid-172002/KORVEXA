import { PROJECT_STATUSES, type ProjectStatus } from '../enums';
import type { Machine } from './engine';

export type ProjectEvent =
  | 'submit_requirements'
  | 'accept'
  | 'decline'
  | 'complete'
  | 'review'
  | 'pause'
  | 'resume'
  | 'request_cancellation'
  | 'decline_cancellation'
  | 'accept_cancellation'
  | 'escalate'
  | 'open_dispute'
  | 'resolve_dispute'
  | 'resume_after_resolution'
  | 'complete_after_resolution'
  | 'cancel_after_resolution';

/** Project lifecycle — docs/STATE_MACHINE.md §1. Guards (funding, all milestones released…) live in the API service. */
export const projectMachine: Machine<ProjectStatus, ProjectEvent> = {
  name: 'project',
  states: PROJECT_STATUSES,
  initial: 'draft',
  terminal: ['reviewed', 'cancelled'],
  transitions: [
    { event: 'submit_requirements', from: ['draft'], to: 'requirements_submitted', actors: ['buyer'] },
    { event: 'accept', from: ['requirements_submitted'], to: 'active', actors: ['seller'] },
    { event: 'decline', from: ['requirements_submitted'], to: 'cancelled', actors: ['seller', 'buyer'] },
    { event: 'complete', from: ['active'], to: 'completed', actors: ['system'] },
    { event: 'review', from: ['completed'], to: 'reviewed', actors: ['buyer', 'system'] },
    { event: 'pause', from: ['active'], to: 'paused', actors: ['buyer', 'seller'] },
    { event: 'resume', from: ['paused'], to: 'active', actors: ['buyer', 'seller', 'admin'] },
    {
      event: 'request_cancellation',
      from: ['active', 'paused'],
      to: 'cancellation_requested',
      actors: ['buyer', 'seller'],
    },
    { event: 'decline_cancellation', from: ['cancellation_requested'], to: 'active', actors: ['buyer', 'seller'] },
    {
      event: 'accept_cancellation',
      from: ['cancellation_requested'],
      to: 'cancelled',
      actors: ['buyer', 'seller', 'admin'],
    },
    { event: 'escalate', from: ['cancellation_requested'], to: 'disputed', actors: ['buyer', 'seller'] },
    { event: 'open_dispute', from: ['active'], to: 'disputed', actors: ['buyer', 'seller'] },
    { event: 'resolve_dispute', from: ['disputed'], to: 'resolved', actors: ['admin'] },
    { event: 'resume_after_resolution', from: ['resolved'], to: 'active', actors: ['system'] },
    { event: 'complete_after_resolution', from: ['resolved'], to: 'completed', actors: ['system'] },
    { event: 'cancel_after_resolution', from: ['resolved'], to: 'cancelled', actors: ['system'] },
  ],
};
