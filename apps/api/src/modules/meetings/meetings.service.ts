import {
  asc,
  auditLogs,
  eq,
  meetingConsents,
  meetings,
  profiles,
  projectEvents,
  projects,
  users,
  inArray,
  type DbClient,
} from '@glasswork/db';
import {
  brand,
  buildIcs,
  isJoinable,
  type MeetingInput,
  type MeetingStatus,
  type MeetingView,
} from '@glasswork/shared';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { RequestActor } from '../../auth/session.service';
import { ENV, type ApiEnv } from '../../config/env';
import { DB } from '../../infra/tokens';
import { AccessService } from '../access/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectNotifier } from '../notifications/project-notifier.service';
import { ProjectsService } from '../orders/projects.service';
import { VideoProvider } from './video.provider';

const MEETABLE = [
  'active',
  'paused',
  'completed',
  'reviewed',
  'disputed',
  'resolved',
  'requirements_submitted',
];

@Injectable()
export class MeetingsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly video: VideoProvider,
    private readonly projectsSvc: ProjectsService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly notifier: ProjectNotifier,
  ) {}

  get enabled() {
    return this.env.VIDEO_PROVIDER !== 'off';
  }
  private requireEnabled() {
    if (!this.enabled) throw new ServiceUnavailableException('Meetings are switched off');
  }

  private async names(ids: string[]) {
    const rows = ids.length
      ? await this.db.db
          .select({ id: profiles.userId, name: profiles.displayName })
          .from(profiles)
          .where(inArray(profiles.userId, ids))
      : [];
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async view(row: typeof meetings.$inferSelect): Promise<MeetingView> {
    const ids = await this.access.projectParticipantIds(row.projectId);
    const consents = await this.db.db
      .select()
      .from(meetingConsents)
      .where(eq(meetingConsents.meetingId, row.id));
    const names = await this.names([...ids, ...(row.organizerId ? [row.organizerId] : [])]);
    const participants = ids.map((id) => ({
      id,
      name: names.get(id) ?? 'Participant',
      consent: row.recordingRequested ? (consents.find((c) => c.userId === id)?.consent ?? null) : null,
    }));
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      agenda: row.agenda,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      status: row.status as MeetingStatus,
      organizer: { id: row.organizerId ?? '', name: names.get(row.organizerId ?? '') ?? 'Organizer' },
      provider: row.provider,
      participants,
      recording: {
        requested: row.recordingRequested,
        allConsented: row.recordingRequested && participants.every((p) => p.consent === true),
      },
      notes: row.notes,
      joinable: isJoinable({
        status: row.status as MeetingStatus,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      }),
    };
  }

  /** Loads a meeting the actor may see; non-participants get 404 (D-011). */
  private async load(actor: RequestActor, id: string) {
    const [row] = await this.db.db.select().from(meetings).where(eq(meetings.id, id));
    if (!row) throw new NotFoundException('Meeting not found');
    await this.projectsSvc.access(actor, row.projectId);
    return row;
  }

  async schedule(actor: RequestActor, projectId: string, input: MeetingInput): Promise<MeetingView> {
    this.requireEnabled();
    const { project } = await this.projectsSvc.access(actor, projectId);
    if (!MEETABLE.includes(project.status))
      throw new UnprocessableEntityException('Meetings can be scheduled once the order has started');
    const startsAt = new Date(input.startsAt);
    if (startsAt.getTime() < Date.now() - 5 * 60_000)
      throw new UnprocessableEntityException('Choose a start time in the future');
    const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);
    const [row] = await this.db.db
      .insert(meetings)
      .values({
        projectId,
        organizerId: actor.userId,
        title: input.title,
        agenda: input.agenda ?? null,
        startsAt,
        endsAt,
        recordingRequested: input.recording,
        provider: this.video.name,
      })
      .returning();
    // The organizer asking for a recording counts as their own consent.
    if (input.recording)
      await this.db.db
        .insert(meetingConsents)
        .values({ meetingId: row!.id, userId: actor.userId, consent: true });
    try {
      // `record` here only makes recording POSSIBLE in the room; it starts later, and only if everyone consented.
      const room = await this.video.createRoom({
        meetingId: row!.id,
        startsAt,
        endsAt,
        record: input.recording,
      });
      await this.db.db
        .update(meetings)
        .set({ roomName: room.roomName, roomUrl: room.roomUrl })
        .where(eq(meetings.id, row!.id));
    } catch {
      await this.db.db.delete(meetings).where(eq(meetings.id, row!.id));
      throw new ServiceUnavailableException('The video service is unavailable. The meeting was not created.');
    }
    await this.db.db.insert(projectEvents).values({
      projectId,
      actorId: actor.userId,
      type: 'meeting.scheduled',
      payload: { meetingId: row!.id, title: input.title, startsAt: startsAt.toISOString() },
    });
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'meeting.scheduled',
      entityType: 'meeting',
      entityId: row!.id,
    });
    const others = (await this.access.projectParticipantIds(projectId)).filter((i) => i !== actor.userId);
    await this.notifications.notify(others, {
      type: 'meeting.scheduled',
      title: `Meeting scheduled on ${project.code}: ${input.title}`,
      body: startsAt.toUTCString(),
      url: `/projects/${projectId}?tab=meetings`,
      payload: { projectId, meetingId: row!.id },
    });
    this.notifier.changed(projectId, 'meeting.scheduled');
    return this.get(actor, row!.id);
  }

  async list(actor: RequestActor, projectId: string): Promise<MeetingView[]> {
    await this.projectsSvc.access(actor, projectId);
    const rows = await this.db.db
      .select()
      .from(meetings)
      .where(eq(meetings.projectId, projectId))
      .orderBy(asc(meetings.startsAt));
    return Promise.all(rows.map((r) => this.view(r)));
  }

  async get(actor: RequestActor, id: string) {
    return this.view(await this.load(actor, id));
  }

  /** Each participant answers for themselves. Consent can be withdrawn until the meeting has started. */
  async consent(actor: RequestActor, id: string, consent: boolean) {
    const m = await this.load(actor, id);
    if (!m.recordingRequested)
      throw new UnprocessableEntityException('Recording was not requested for this meeting');
    if (m.status !== 'scheduled')
      throw new ConflictException('Consent can only be changed before the meeting starts');
    await this.db.db
      .insert(meetingConsents)
      .values({ meetingId: id, userId: actor.userId, consent })
      .onConflictDoUpdate({
        target: [meetingConsents.meetingId, meetingConsents.userId],
        set: { consent, decidedAt: new Date() },
      });
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: consent ? 'meeting.recording_consent_given' : 'meeting.recording_consent_withdrawn',
      entityType: 'meeting',
      entityId: id,
    });
    this.notifier.changed(m.projectId, 'meeting.consent');
    return this.get(actor, id);
  }

  /** Returns where to join. Recording is on only if the meeting requested it AND every participant consented. */
  async join(actor: RequestActor, id: string) {
    this.requireEnabled();
    const m = await this.load(actor, id);
    const v = await this.view(m);
    if (!v.joinable) throw new UnprocessableEntityException('This meeting is not open for joining right now');
    if (!m.roomName || !m.roomUrl) throw new ServiceUnavailableException('The room is not ready');
    const record = v.recording.allConsented;
    const url = await this.video.joinUrl({
      meetingId: id,
      roomName: m.roomName,
      roomUrl: m.roomUrl,
      user: { id: actor.userId, name: actor.name },
      isOrganizer: m.organizerId === actor.userId,
      record,
      endsAt: m.endsAt,
    });
    if (m.status === 'scheduled') {
      await this.db.db.update(meetings).set({ status: 'started' }).where(eq(meetings.id, id));
      this.notifier.changed(m.projectId, 'meeting.started');
    }
    return { url, provider: this.video.name, recording: record };
  }

  async cancel(actor: RequestActor, id: string) {
    const m = await this.load(actor, id);
    if (m.organizerId !== actor.userId)
      throw new UnprocessableEntityException('Only the organizer can cancel');
    if (m.status === 'cancelled' || m.status === 'ended')
      throw new ConflictException('This meeting is already over');
    await this.db.db.update(meetings).set({ status: 'cancelled' }).where(eq(meetings.id, id));
    if (m.roomName) await this.video.deleteRoom(m.roomName);
    const others = (await this.access.projectParticipantIds(m.projectId)).filter((i) => i !== actor.userId);
    await this.notifications.notify(others, {
      type: 'meeting.cancelled',
      title: `Meeting cancelled: ${m.title}`,
      url: `/projects/${m.projectId}?tab=meetings`,
      payload: { projectId: m.projectId, meetingId: id },
    });
    await this.db.db.insert(projectEvents).values({
      projectId: m.projectId,
      actorId: actor.userId,
      type: 'meeting.cancelled',
      payload: { meetingId: id, title: m.title },
    });
    this.notifier.changed(m.projectId, 'meeting.cancelled');
    return this.get(actor, id);
  }

  async end(actor: RequestActor, id: string) {
    const m = await this.load(actor, id);
    if (m.status === 'cancelled' || m.status === 'ended')
      throw new ConflictException('This meeting is already over');
    await this.db.db.update(meetings).set({ status: 'ended' }).where(eq(meetings.id, id));
    this.notifier.changed(m.projectId, 'meeting.ended');
    return this.get(actor, id);
  }

  async setNotes(actor: RequestActor, id: string, notes: string) {
    const m = await this.load(actor, id);
    if (m.status === 'cancelled') throw new ConflictException('This meeting was cancelled');
    await this.db.db
      .update(meetings)
      .set({ notes: notes || null })
      .where(eq(meetings.id, id));
    this.notifier.changed(m.projectId, 'meeting.notes');
    return this.get(actor, id);
  }

  /** The calendar file for one meeting. Only participants may download it (it contains attendee emails). */
  async ics(actor: RequestActor, id: string): Promise<string> {
    const m = await this.load(actor, id);
    const [p] = await this.db.db.select().from(projects).where(eq(projects.id, m.projectId));
    const ids = await this.access.projectParticipantIds(m.projectId);
    const people = await this.db.db
      .select({ id: users.id, email: users.email, name: profiles.displayName })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(inArray(users.id, ids));
    const organizer = people.find((x) => x.id === m.organizerId) ?? people[0];
    if (!organizer) throw new NotFoundException('Meeting not found');
    return buildIcs({
      uid: `${m.id}@${brand.productName.toLowerCase()}`,
      title: `${m.title} (${p?.code ?? brand.productName})`,
      description: [m.agenda, `Join: ${this.env.WEB_URL}/meetings/${m.id}/call`].filter(Boolean).join('\n\n'),
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      url: `${this.env.WEB_URL}/meetings/${m.id}/call`,
      organizer: { name: organizer.name, email: organizer.email },
      attendees: people.filter((x) => x.id !== organizer.id).map((x) => ({ name: x.name, email: x.email })),
      cancelled: m.status === 'cancelled',
      sequence: m.status === 'cancelled' ? 1 : 0,
    });
  }
}
