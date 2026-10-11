import {
  adminServicesQuerySchema,
  moderationDecisionSchema,
  platformFlagSchema,
  type AdminScope,
} from '@glasswork/shared';
import { eq, users, type DbClient } from '@glasswork/db';
import { Body, Controller, ForbiddenException, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';
import { ServicesService } from './services.service';

class QueryDto extends createZodDto(adminServicesQuerySchema) {}
class DecisionDto extends createZodDto(moderationDecisionSchema) {}
class FlagDto extends createZodDto(platformFlagSchema) {}
class IdParamDto extends createZodDto(z.object({ id: z.uuid() })) {}

/** Gig moderation queue. Admin role at the guard; scope checked here (operations or product moderate). */
@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin/services')
export class AdminServicesController {
  constructor(
    private readonly services: ServicesService,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  private async requireScope(actor: RequestActor, allowed: readonly AdminScope[]) {
    const [me] = await this.db.db
      .select({ scopes: users.adminScopes })
      .from(users)
      .where(eq(users.id, actor.userId));
    if (!me?.scopes.some((s) => allowed.includes(s))) {
      throw new ForbiddenException(`Requires one of the admin scopes: ${allowed.join(', ')}`);
    }
  }

  @Policy('admin role required to view the moderation queue', ['admin'])
  @Get()
  list(@Query() q: QueryDto) {
    return this.services.adminList(q.status, q.cursor, q.limit);
  }

  @Policy('admin role required to read a service under review', ['admin'])
  @Get(':id')
  get(@Param() p: IdParamDto) {
    return this.services.adminDetail(p.id);
  }

  @Policy('operations or product admins approve services', ['admin'])
  @Post(':id/approve')
  async approve(@CurrentActor() a: RequestActor, @Param() p: IdParamDto) {
    await this.requireScope(a, ['operations', 'product']);
    return this.services.moderate(a, p.id, 'approve');
  }

  @Policy('operations or product admins reject services, with a reason', ['admin'])
  @Post(':id/reject')
  async reject(@CurrentActor() a: RequestActor, @Param() p: IdParamDto, @Body() b: DecisionDto) {
    await this.requireScope(a, ['operations', 'product']);
    return this.services.moderate(a, p.id, 'reject', b.reason);
  }

  @Policy('only product admins set the “Operated by” label; it never affects ranking (D-002)', ['admin'])
  @Patch(':id/operated-by-platform')
  async flag(@CurrentActor() a: RequestActor, @Param() p: IdParamDto, @Body() b: FlagDto) {
    await this.requireScope(a, ['product']);
    return this.services.setPlatformFlag(a, p.id, b.operatedByPlatform);
  }
}
