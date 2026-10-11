import { and, auditLogs, desc, eq, gt, sessions, type DbClient } from '@glasswork/db';
import type { SessionView } from '@glasswork/shared';
import { Controller, Delete, Get, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Auth } from '../../auth/auth';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { AUTH, DB } from '../../infra/tokens';

class SessionParamDto extends createZodDto(z.object({ sessionId: z.uuid() })) {}

function toHeaders(raw: FastifyRequest['headers']): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(raw))
    if (v !== undefined) h.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  return h;
}

/** Session list + "log out everywhere". Revocation goes through Better Auth so the Redis cache is cleared too. */
@ApiTags('sessions')
@ApiCookieAuth()
@Controller('me/sessions')
export class SessionsController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(AUTH) private readonly auth: Auth,
  ) {}

  @Policy('a user lists only their own sessions')
  @Get()
  async list(@CurrentActor() actor: RequestActor): Promise<SessionView[]> {
    const rows = await this.db.db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, actor.userId), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt));
    return rows.map((s) => ({
      id: s.id,
      current: s.id === actor.sessionId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  @Policy('a user revokes only their own sessions; others get 404')
  @Delete(':sessionId')
  async revoke(@CurrentActor() actor: RequestActor, @Param() p: SessionParamDto, @Req() req: FastifyRequest) {
    const [row] = await this.db.db
      .select({ token: sessions.token })
      .from(sessions)
      .where(and(eq(sessions.id, p.sessionId), eq(sessions.userId, actor.userId)));
    if (!row) throw new NotFoundException('Session not found');
    await this.auth.api.revokeSession({ headers: toHeaders(req.headers), body: { token: row.token } });
    await this.audit(actor, 'session.revoked', p.sessionId);
    return { ok: true };
  }

  @Policy('a user signs out all of their own other sessions')
  @Post('revoke-others')
  async revokeOthers(@CurrentActor() actor: RequestActor, @Req() req: FastifyRequest) {
    await this.auth.api.revokeOtherSessions({ headers: toHeaders(req.headers) });
    await this.audit(actor, 'session.revoked_others', actor.userId);
    return { ok: true };
  }

  @Policy('a user signs out everywhere, including this device')
  @Post('revoke-all')
  async revokeAll(@CurrentActor() actor: RequestActor, @Req() req: FastifyRequest) {
    await this.auth.api.revokeSessions({ headers: toHeaders(req.headers) });
    await this.audit(actor, 'session.revoked_all', actor.userId);
    return { ok: true };
  }

  private audit(actor: RequestActor, action: string, entityId: string) {
    return this.db.db
      .insert(auditLogs)
      .values({ actorId: actor.userId, action, entityType: 'session', entityId });
  }
}
