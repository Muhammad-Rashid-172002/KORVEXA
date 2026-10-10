import { type DbClient, sql } from '@glasswork/db';
import { Controller, Get, HttpCode, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import { Public } from '../../common/policy/decorators';
import { DB, REDIS } from '../../infra/tokens';

@ApiTags('health')
@Controller({ path: '', version: undefined })
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up. */
  @Public()
  @Get('health')
  @HttpCode(200)
  health() {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable. */
  @Public()
  @Get('ready')
  async ready() {
    const checks = await Promise.allSettled([this.db.db.execute(sql`select 1`), this.redis.ping()]);
    const [pg, redis] = checks.map((c) => c.status === 'fulfilled');
    if (!pg || !redis) throw new ServiceUnavailableException({ message: 'Dependencies unavailable', pg, redis });
    return { status: 'ready', pg, redis };
  }
}
