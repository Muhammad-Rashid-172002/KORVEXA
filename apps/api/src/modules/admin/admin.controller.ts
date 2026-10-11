import { and, auditLogs, desc, eq, lt, profiles, sql, users, type DbClient } from '@glasswork/db';
import { adminAuditQuerySchema, adminScopesSchema, adminUsersQuerySchema } from '@glasswork/shared';
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';

class UsersQueryDto extends createZodDto(adminUsersQuerySchema) {}
class AuditQueryDto extends createZodDto(adminAuditQuerySchema) {}
class ScopesDto extends createZodDto(adminScopesSchema) {}
class UserParamDto extends createZodDto(z.object({ userId: z.uuid() })) {}

/** Admin skeleton (Phase 1): role-gated at the guard; scope checks inside. Every mutation is audited. */
@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin')
export class AdminController {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  @Policy('admin role required (any scope) to list users', ['admin'])
  @Get('users')
  async users(@Query() q: UsersQueryDto) {
    const needle = q.q ? `%${q.q.replace(/[%_\\]/g, '\\$&')}%` : null;
    const rows = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        roles: users.roles,
        adminScopes: users.adminScopes,
        emailVerified: users.emailVerified,
        bannedAt: users.bannedAt,
        createdAt: users.createdAt,
        isSeed: users.isSeed,
        displayName: profiles.displayName,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          q.cursor ? lt(users.id, q.cursor) : undefined,
          needle ? sql`(${users.email} ilike ${needle} or ${users.name} ilike ${needle})` : undefined,
        ),
      )
      .orderBy(desc(users.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return { items: page, nextCursor: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null };
  }

  @Policy('admin role required to read the audit log', ['admin'])
  @Get('audit-logs')
  async audit(@Query() q: AuditQueryDto) {
    const rows = await this.db.db
      .select()
      .from(auditLogs)
      .where(
        and(
          q.cursor ? lt(auditLogs.id, q.cursor) : undefined,
          q.action ? eq(auditLogs.action, q.action) : undefined,
          q.entityType ? eq(auditLogs.entityType, q.entityType) : undefined,
        ),
      )
      .orderBy(desc(auditLogs.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return { items: page, nextCursor: rows.length > q.limit ? (page.at(-1)?.id ?? null) : null };
  }

  @Policy('only admins holding the product scope assign admin scopes', ['admin'])
  @Patch('users/:userId/scopes')
  async setScopes(@CurrentActor() actor: RequestActor, @Param() p: UserParamDto, @Body() b: ScopesDto) {
    const [me] = await this.db.db
      .select({ scopes: users.adminScopes })
      .from(users)
      .where(eq(users.id, actor.userId));
    if (!me?.scopes.includes('product')) throw new ForbiddenException('Requires the product admin scope');
    const [target] = await this.db.db
      .select({ roles: users.roles, scopes: users.adminScopes })
      .from(users)
      .where(eq(users.id, p.userId));
    if (!target) throw new NotFoundException('User not found');
    const roles = b.scopes.length
      ? [...new Set([...target.roles, 'admin' as const])]
      : target.roles.filter((r) => r !== 'admin');
    await this.db.db.transaction(async (tx) => {
      await tx.update(users).set({ adminScopes: b.scopes, roles }).where(eq(users.id, p.userId));
      await tx.insert(auditLogs).values({
        actorId: actor.userId,
        action: 'admin.scopes_changed',
        entityType: 'user',
        entityId: p.userId,
        before: { scopes: target.scopes },
        after: { scopes: b.scopes },
      });
    });
    return { id: p.userId, adminScopes: b.scopes };
  }
}
