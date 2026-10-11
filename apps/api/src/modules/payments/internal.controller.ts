import { Controller, Headers, Inject, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { requireInternalToken } from '../../common/internal-auth';
import { z } from 'zod';
import { Public } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { MilestonesService } from '../orders/milestones.service';

/** Worker → API callbacks for delayed jobs. Authenticated by a shared secret, never exposed to browsers. */
@ApiExcludeController()
@Controller('internal/milestones')
export class InternalController {
  constructor(
    private readonly milestones: MilestonesService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private check(token: string | undefined) {
    requireInternalToken(token, this.env.INTERNAL_API_TOKEN);
  }

  @Public()
  @Post(':id/auto-approve')
  autoApprove(@Param('id') id: string, @Headers('x-internal-token') token: string | undefined) {
    this.check(token);
    return this.milestones.autoApprove(z.uuid().parse(id));
  }

  @Public()
  @Post(':id/remind')
  remind(@Param('id') id: string, @Headers('x-internal-token') token: string | undefined) {
    this.check(token);
    return this.milestones.remind(z.uuid().parse(id));
  }
}
