import { Controller, ForbiddenException, Headers, Inject, Param, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { MilestonesService } from '../orders/milestones.service';

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Worker → API callbacks for delayed jobs. Authenticated by a shared secret, never exposed to browsers. */
@ApiExcludeController()
@Controller('internal/milestones')
export class InternalController {
  constructor(
    private readonly milestones: MilestonesService,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  private check(token: string | undefined) {
    if (!token || !safeEqual(token, this.env.INTERNAL_API_TOKEN)) throw new ForbiddenException();
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
