import { profiles, users, type DbClient } from '@glasswork/db';
import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';
import { ACTIVE_MODES, ADMIN_SCOPES, USER_ROLES } from '@glasswork/shared';

const meSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  roles: z.array(z.enum(USER_ROLES)),
  adminScopes: z.array(z.enum(ADMIN_SCOPES)),
  activeMode: z.enum(ACTIVE_MODES),
  // .min(1) keeps nestjs-zod on the anyOf path (a bare .nullable() string is mis-rendered as an array).
  displayName: z.string().min(1).nullable(),
});
class MeDto extends createZodDto(meSchema) {}

@ApiTags('me')
@ApiCookieAuth()
@Controller('me')
export class MeController {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  @Policy('the signed-in user reads their own account')
  @Get()
  @ApiOkResponse({ type: MeDto })
  async me(@CurrentActor() actor: RequestActor): Promise<MeDto> {
    const [row] = await this.db.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
        roles: users.roles,
        adminScopes: users.adminScopes,
        activeMode: users.activeMode,
        displayName: profiles.displayName,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, actor.userId));
    if (!row) throw new NotFoundException();
    return row;
  }
}
