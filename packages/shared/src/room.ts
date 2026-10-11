import { z } from 'zod';
import type {
  DeliverableStatus,
  HealthState,
  MilestoneStatus,
  PreviewKind,
  ProjectStatus,
  TaskStatus,
} from './enums';
import { PREVIEW_KINDS, TASK_STATUSES } from './enums';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

// ---- health --------------------------------------------------------------------------

export interface HealthInput {
  projectStatus: ProjectStatus;
  projectCreatedAt: Date;
  milestones: {
    position: number;
    status: MilestoneStatus;
    /** YYYY-MM-DD */
    plannedDue: string | null;
    submittedAt: Date | null;
    revisionCount: number;
  }[];
  now: Date;
}

const DAY = 86_400_000;
const TERMINAL: readonly MilestoneStatus[] = ['released', 'cancelled', 'refunded'];

/**
 * Project health from facts only (never a guess): blocked beats at_risk beats on_track, with a plain-English
 * reason (brief §8.1). Pure so the thresholds are unit-tested.
 */
export function computeHealth(i: HealthInput): { health: HealthState; reason: string | null } {
  const ok = { health: 'on_track' as const, reason: null };
  switch (i.projectStatus) {
    case 'paused':
      return { health: 'blocked', reason: 'The project is paused' };
    case 'disputed':
      return { health: 'blocked', reason: 'A dispute is open' };
    case 'cancellation_requested':
      return { health: 'blocked', reason: 'A cancellation was requested' };
    case 'cancelled':
      return { health: 'blocked', reason: 'The project was cancelled' };
    case 'completed':
    case 'reviewed':
    case 'resolved':
    case 'draft':
      return ok;
    case 'requirements_submitted': {
      const ageDays = (i.now.getTime() - i.projectCreatedAt.getTime()) / DAY;
      const first = i.milestones.find((m) => m.position === 1);
      if (first?.status === 'pending' && ageDays > 3) {
        return { health: 'blocked', reason: 'Waiting for the buyer to fund the first milestone' };
      }
      if (first?.status === 'funded' && ageDays > 3) {
        return { health: 'at_risk', reason: 'Waiting for the seller to accept the order' };
      }
      return ok;
    }
    case 'active':
      break;
  }

  const open = [...i.milestones]
    .sort((a, b) => a.position - b.position)
    .filter((m) => !TERMINAL.includes(m.status));
  const next = open[0];
  if (next && next.status === 'pending') {
    return { health: 'blocked', reason: `Waiting for the buyer to fund milestone ${next.position}` };
  }
  const today = i.now.toISOString().slice(0, 10);
  const overdue = open.find(
    (m) =>
      ['funded', 'in_progress', 'revision_requested'].includes(m.status) &&
      m.plannedDue &&
      m.plannedDue < today,
  );
  if (overdue) return { health: 'at_risk', reason: `Milestone ${overdue.position} is past its planned date` };
  const waiting = open.find(
    (m) => m.status === 'submitted' && m.submittedAt && i.now.getTime() - m.submittedAt.getTime() > 3 * DAY,
  );
  if (waiting) {
    const days = Math.floor((i.now.getTime() - waiting.submittedAt!.getTime()) / DAY);
    return { health: 'at_risk', reason: `Milestone ${waiting.position} has waited ${days} days for review` };
  }
  const churn = open.find((m) => m.revisionCount >= 3);
  if (churn)
    return {
      health: 'at_risk',
      reason: `Milestone ${churn.position} is on revision round ${churn.revisionCount + 1}`,
    };
  return ok;
}

// ---- inputs -----------------------------------------------------------------------------

export const taskInputSchema = z.object({
  title: text(2, 160),
  description: z.string().trim().max(4000).nullable().optional(),
  milestoneId: z.uuid().nullable().optional(),
  assigneeId: z.uuid().nullable().optional(),
  status: z.enum(TASK_STATUSES).default('todo'),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskPatchSchema = z
  .object({
    title: text(2, 160),
    description: z.string().trim().max(4000).nullable(),
    milestoneId: z.uuid().nullable(),
    assigneeId: z.uuid().nullable(),
    status: z.enum(TASK_STATUSES),
    /** Target index within the destination column. */
    position: z.number().int().min(0).max(10_000),
  })
  .partial();
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const commentInputSchema = z.object({ body: text(1, 4000) });

export const deliverableInputSchema = z.object({
  fileId: z.uuid(),
  note: z.string().trim().max(2000).optional(),
});

export const anchorSchema = z
  .object({
    kind: z.enum(['page', 'region', 'timecode']),
    page: z.number().int().min(1).max(10_000).optional(),
    /** Region as fractions of the page/image (0–1). */
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
    w: z.number().min(0).max(1).optional(),
    h: z.number().min(0).max(1).optional(),
    /** Seconds into a video. */
    t: z.number().min(0).max(86_400).optional(),
  })
  .strict();
export const feedbackInputSchema = z.object({
  anchor: anchorSchema.default({ kind: 'page' }),
  body: text(1, 4000),
});

const httpsUrl = z
  .url()
  .max(500)
  .refine((u) => /^https:\/\//i.test(u), 'Preview links must be https');
export const previewInputSchema = z.object({
  kind: z.enum(PREVIEW_KINDS),
  label: text(2, 100),
  url: httpsUrl,
  milestoneId: z.uuid().nullable().optional(),
});

export const EVENT_FILTERS = ['all', 'money', 'milestones', 'tasks', 'files', 'chat'] as const;
export const eventsQuerySchema = z.object({
  filter: z.enum(EVENT_FILTERS).default('all'),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** Which event-type prefixes belong to each feed filter. */
export const EVENT_FILTER_PREFIXES: Record<(typeof EVENT_FILTERS)[number], readonly string[]> = {
  all: [],
  money: ['payment.', 'milestone.funded', 'milestone.released', 'milestone.refunded'],
  milestones: ['milestone.', 'project.'],
  tasks: ['task.'],
  files: ['deliverable.', 'preview.'],
  chat: ['chat.'],
};

// ---- views -------------------------------------------------------------------------------

export interface TaskView {
  id: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  sortOrder: number;
  assignee: { id: string; name: string } | null;
  commentCount: number;
  createdAt: string;
}

export interface TaskCommentView {
  id: string;
  author: { id: string | null; name: string };
  body: string;
  createdAt: string;
}

export interface FeedbackView {
  id: string;
  author: { id: string | null; name: string };
  anchor: z.infer<typeof anchorSchema>;
  body: string;
  resolved: boolean;
  createdAt: string;
}

export interface DeliverableView {
  id: string;
  milestoneId: string;
  version: number;
  status: DeliverableStatus;
  note: string | null;
  file: { id: string; name: string; sizeBytes: number; mimeType: string; status: string };
  submittedBy: { id: string | null; name: string };
  feedback: FeedbackView[];
  createdAt: string;
}

export interface PreviewView {
  id: string;
  kind: PreviewKind;
  label: string;
  url: string;
  milestoneId: string | null;
  lastUpdatedAt: string;
}

export interface ProjectEventView {
  id: string;
  type: string;
  actor: { id: string | null; name: string } | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ---- notifications -----------------------------------------------------------------------

export interface NotificationTypeDef {
  label: string;
  /** Defaults used until the user changes their per-type preferences. */
  defaults: { inApp: boolean; email: boolean; push: boolean };
}

/** Every notification type the app can send (drives the preferences screen). */
export const NOTIFICATION_TYPES = {
  'milestone.funded': { label: 'A milestone was funded', defaults: { inApp: true, email: true, push: true } },
  'milestone.submitted': {
    label: 'A milestone was submitted for review',
    defaults: { inApp: true, email: true, push: true },
  },
  'milestone.revision_requested': {
    label: 'Changes were requested',
    defaults: { inApp: true, email: true, push: true },
  },
  'milestone.released': {
    label: 'A milestone was approved and paid',
    defaults: { inApp: true, email: true, push: true },
  },
  'milestone.reminder': { label: 'Review reminders', defaults: { inApp: true, email: true, push: true } },
  'project.accepted': { label: 'An order was accepted', defaults: { inApp: true, email: true, push: true } },
  'project.declined': {
    label: 'An order was declined or withdrawn',
    defaults: { inApp: true, email: true, push: true },
  },
  'task.comment': { label: 'New comment on a task', defaults: { inApp: true, email: false, push: false } },
  'deliverable.uploaded': {
    label: 'A new deliverable version',
    defaults: { inApp: true, email: true, push: false },
  },
  'deliverable.feedback': {
    label: 'New feedback on a deliverable',
    defaults: { inApp: true, email: false, push: false },
  },
  'chat.message': { label: 'New chat messages', defaults: { inApp: true, email: false, push: true } },
  'offer.received': {
    label: 'You received a custom offer',
    defaults: { inApp: true, email: true, push: true },
  },
  'offer.accepted': {
    label: 'Your custom offer was accepted',
    defaults: { inApp: true, email: true, push: true },
  },
  'proposal.received': {
    label: 'New proposal on your request',
    defaults: { inApp: true, email: true, push: true },
  },
  'proposal.accepted': {
    label: 'Your proposal was accepted',
    defaults: { inApp: true, email: true, push: true },
  },
  'payout.paid': { label: 'A payout was sent', defaults: { inApp: true, email: true, push: false } },
} as const satisfies Record<string, NotificationTypeDef>;
export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export const notificationPrefsSchema = z.object({
  prefs: z
    .array(
      z.object({
        type: z.string().max(80),
        inApp: z.boolean(),
        email: z.boolean(),
        push: z.boolean(),
      }),
    )
    .max(50),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(6).max(100) }),
});

// ---- chat & custom offers ------------------------------------------------------------------

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4000).default(''),
    fileIds: z.array(z.uuid()).max(5).default([]),
  })
  .refine((v) => v.body.length > 0 || v.fileIds.length > 0, { message: 'Write a message or attach a file' });

export const messagesQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});

export const startDirectSchema = z.object({ userId: z.uuid() });
export const markReadSchema = z.object({ messageId: z.uuid() });

export const offerInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(3000),
  milestonePlan: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(100),
        acceptanceCriteria: z.string().trim().max(1000).nullable().optional(),
        amount: z.number().int().min(500).max(10_000_000),
        days: z.number().int().min(1).max(180),
      }),
    )
    .min(1)
    .max(10),
});

export interface ConversationView {
  id: string;
  kind: 'direct' | 'project';
  projectId: string | null;
  title: string;
  counterpartId: string;
  lastMessage: { body: string; at: string; senderId: string | null } | null;
  unread: number;
}

export interface MessagePageView {
  conversationId: string;
  members: { userId: string; name: string; lastReadMessageId: string | null }[];
  items: import('./realtime').ChatMessageView[];
  nextCursor: string | null;
}
