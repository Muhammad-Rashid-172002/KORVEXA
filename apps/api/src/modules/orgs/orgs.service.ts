import {
  and,
  auditLogs,
  eq,
  isNull,
  orgInvites,
  orgMembers,
  organizations,
  users,
  type DbClient,
} from '@glasswork/db';
import type { OrgRole, OrgView } from '@glasswork/shared';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { RequestActor } from '../../auth/session.service';
import { ENV, type ApiEnv } from '../../config/env';
import type { EmailQueue } from '../../infra/infra.module';
import { DB, EMAIL_QUEUE } from '../../infra/tokens';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const canManage = (role: OrgRole) => role === 'owner' || role === 'admin';

@Injectable()
export class OrgsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(EMAIL_QUEUE) private readonly emailQueue: EmailQueue,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  async create(actor: RequestActor, input: { name: string; kind: 'buyer_team' | 'agency' }) {
    const org = await this.db.db.transaction(async (tx) => {
      const [o] = await tx
        .insert(organizations)
        .values({ name: input.name, kind: input.kind, createdBy: actor.userId })
        .returning();
      if (!o) throw new Error('insert failed');
      await tx.insert(orgMembers).values({ orgId: o.id, userId: actor.userId, role: 'owner' });
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'org.created',
        entityType: 'organization',
        entityId: o.id,
        after: { name: o.name, kind: o.kind },
      });
      return o;
    });
    return this.get(actor, org.id);
  }

  async listMine(actor: RequestActor) {
    return this.db.db
      .select({
        id: organizations.id,
        name: organizations.name,
        kind: organizations.kind,
        myRole: orgMembers.role,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
      .where(eq(orgMembers.userId, actor.userId));
  }

  /** Non-members get 404, never 403, so org existence isn't leaked (D-011). */
  private async membership(actor: RequestActor, orgId: string): Promise<OrgRole> {
    const [m] = await this.db.db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, actor.userId)));
    if (!m) throw new NotFoundException('Organization not found');
    return m.role;
  }

  async get(actor: RequestActor, orgId: string): Promise<OrgView> {
    const myRole = await this.membership(actor, orgId);
    const [org] = await this.db.db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw new NotFoundException('Organization not found');
    const members = await this.db.db
      .select({ userId: users.id, name: users.name, email: users.email, role: orgMembers.role })
      .from(orgMembers)
      .innerJoin(users, eq(users.id, orgMembers.userId))
      .where(eq(orgMembers.orgId, orgId));
    const invites = canManage(myRole)
      ? await this.db.db
          .select({
            id: orgInvites.id,
            email: orgInvites.email,
            role: orgInvites.role,
            expiresAt: orgInvites.expiresAt,
          })
          .from(orgInvites)
          .where(and(eq(orgInvites.orgId, orgId), isNull(orgInvites.acceptedAt)))
      : [];
    return {
      id: org.id,
      name: org.name,
      kind: org.kind,
      myRole,
      members,
      invites: invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() })),
    };
  }

  async invite(actor: RequestActor, orgId: string, input: { email: string; role: OrgRole }) {
    const myRole = await this.membership(actor, orgId);
    if (!canManage(myRole)) throw new ForbiddenException('Only owners and admins can invite');
    const [org] = await this.db.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    if (!org) throw new NotFoundException();

    const [existing] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(orgMembers, and(eq(orgMembers.userId, users.id), eq(orgMembers.orgId, orgId)))
      .where(eq(users.email, input.email));
    if (existing) throw new ConflictException('Already a member');

    const token = randomBytes(32).toString('base64url');
    await this.db.db.transaction(async (tx) => {
      // Re-inviting replaces the pending invite so older links stop working.
      await tx
        .delete(orgInvites)
        .where(
          and(eq(orgInvites.orgId, orgId), eq(orgInvites.email, input.email), isNull(orgInvites.acceptedAt)),
        );
      await tx.insert(orgInvites).values({
        orgId,
        email: input.email,
        role: input.role,
        tokenHash: sha256(token),
        invitedBy: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'org.invite_sent',
        entityType: 'organization',
        entityId: orgId,
        after: { email: input.email, role: input.role },
      });
    });
    await this.emailQueue.add('org-invite', {
      template: 'org-invite',
      to: input.email,
      data: {
        inviterName: actor.name,
        orgName: org.name,
        url: `${this.env.WEB_URL}/invites/accept?token=${token}`,
      },
    });
    return this.get(actor, orgId);
  }

  async revokeInvite(actor: RequestActor, orgId: string, inviteId: string) {
    const myRole = await this.membership(actor, orgId);
    if (!canManage(myRole)) throw new ForbiddenException('Only owners and admins can revoke invites');
    await this.db.db.delete(orgInvites).where(and(eq(orgInvites.id, inviteId), eq(orgInvites.orgId, orgId)));
    return this.get(actor, orgId);
  }

  async accept(actor: RequestActor, token: string) {
    const [inv] = await this.db.db
      .select()
      .from(orgInvites)
      .where(eq(orgInvites.tokenHash, sha256(token)));
    const [u] = await this.db.db
      .select({ email: users.email, verified: users.emailVerified })
      .from(users)
      .where(eq(users.id, actor.userId));
    // Wrong user, expired, used or unknown tokens are indistinguishable.
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date() || !u?.verified || u.email !== inv.email) {
      throw new NotFoundException('Invitation not found or expired');
    }
    await this.db.db.transaction(async (tx) => {
      await tx
        .insert(orgMembers)
        .values({ orgId: inv.orgId, userId: actor.userId, role: inv.role })
        .onConflictDoNothing();
      await tx.update(orgInvites).set({ acceptedAt: new Date() }).where(eq(orgInvites.id, inv.id));
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'org.invite_accepted',
        entityType: 'organization',
        entityId: inv.orgId,
      });
    });
    return this.get(actor, inv.orgId);
  }

  async setRole(actor: RequestActor, orgId: string, userId: string, role: OrgRole) {
    const myRole = await this.membership(actor, orgId);
    if (myRole !== 'owner') throw new ForbiddenException('Only the owner can change roles');
    const updated = await this.db.db
      .update(orgMembers)
      .set({ role })
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId), eq(orgMembers.role, 'member')))
      .returning();
    const updatedAdmin = updated.length
      ? updated
      : await this.db.db
          .update(orgMembers)
          .set({ role })
          .where(
            and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId), eq(orgMembers.role, 'admin')),
          )
          .returning();
    if (!updatedAdmin.length) throw new UnprocessableEntityException('Member not found or is the owner');
    return this.get(actor, orgId);
  }

  async removeMember(actor: RequestActor, orgId: string, userId: string) {
    const myRole = await this.membership(actor, orgId);
    const isSelf = userId === actor.userId;
    if (!isSelf && !canManage(myRole))
      throw new ForbiddenException('Only owners and admins can remove members');
    const [target] = await this.db.db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') throw new UnprocessableEntityException('The owner cannot be removed');
    if (!isSelf && myRole === 'admin' && target.role === 'admin') {
      throw new ForbiddenException('Admins cannot remove other admins');
    }
    await this.db.db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
    await this.db.db.insert(auditLogs).values({
      actorId: actor.userId,
      action: 'org.member_removed',
      entityType: 'organization',
      entityId: orgId,
      after: { userId },
    });
    return isSelf ? { left: true } : this.get(actor, orgId);
  }
}
