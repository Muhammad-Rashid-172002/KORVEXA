import { and, eq, milestones, profiles, projects, type DbClient } from '@glasswork/db';
import type { NotificationType } from '@glasswork/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { DB } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from './notifications.service';

/** What to tell the OTHER participant for an event, keyed by the project-event type. */
const MESSAGES: Record<string, { type: NotificationType; title: (m: string, p: string) => string }> = {
  'milestone.funded': { type: 'milestone.funded', title: (m, p) => `${m} was funded on ${p}` },
  'milestone.submitted': {
    type: 'milestone.submitted',
    title: (m, p) => `${m} is ready for your review on ${p}`,
  },
  'milestone.revision_requested': {
    type: 'milestone.revision_requested',
    title: (m, p) => `Changes requested on ${m} (${p})`,
  },
  'milestone.released': { type: 'milestone.released', title: (m, p) => `${m} was approved and paid on ${p}` },
  'project.accepted': { type: 'project.accepted', title: (_m, p) => `${p} was accepted and is now active` },
  'project.declined': { type: 'project.declined', title: (_m, p) => `${p} was declined and refunded` },
  'project.withdrawn': { type: 'project.declined', title: (_m, p) => `${p} was withdrawn and refunded` },
};

/** Called AFTER a transaction commits: pushes a realtime refresh hint and notifies the counterpart. Never throws. */
@Injectable()
export class ProjectNotifier {
  private readonly logger = new Logger(ProjectNotifier.name);

  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly access: AccessService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tell open Room tabs to refresh, without notifying anyone (e.g. a task moved). */
  changed(projectId: string, type: string) {
    this.realtime.toProject(projectId, 'project:event', { projectId, type });
  }

  async event(projectId: string, actorId: string | null, type: string, milestoneId?: string): Promise<void> {
    try {
      this.changed(projectId, type);
      const msg = MESSAGES[type];
      if (!msg) return;
      const [p] = await this.db.db
        .select({ title: projects.title, code: projects.code })
        .from(projects)
        .where(eq(projects.id, projectId));
      let mTitle = '';
      if (milestoneId) {
        const [m] = await this.db.db
          .select({ title: milestones.title })
          .from(milestones)
          .where(and(eq(milestones.id, milestoneId), eq(milestones.projectId, projectId)));
        mTitle = m?.title ?? '';
      }
      const others = (await this.access.projectParticipantIds(projectId)).filter((id) => id !== actorId);
      await this.notifications.notify(others, {
        type: msg.type,
        title: msg.title(mTitle, p?.code ?? 'project'),
        url: `/projects/${projectId}`,
        payload: { projectId, milestoneId },
      });
    } catch (err) {
      this.logger.error({ err, projectId, type }, 'project notification failed');
    }
  }

  async direct(projectId: string, actorId: string, type: NotificationType, title: string, body?: string) {
    try {
      this.changed(projectId, type);
      const others = (await this.access.projectParticipantIds(projectId)).filter((id) => id !== actorId);
      await this.notifications.notify(others, {
        type,
        title,
        body: body ?? null,
        url: `/projects/${projectId}`,
        payload: { projectId },
      });
    } catch (err) {
      this.logger.error({ err, projectId, type }, 'project notification failed');
    }
  }

  async nameOf(userId: string): Promise<string> {
    const [p] = await this.db.db
      .select({ name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    return p?.name ?? 'Someone';
  }
}
