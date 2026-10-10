import type { DbClient } from '@glasswork/db';
import { Global, Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ENV, type ApiEnv } from '../config/env';
import type { EmailQueue } from '../infra/infra.module';
import { AUTH, DB, EMAIL_QUEUE, REDIS } from '../infra/tokens';
import { createAuth } from './auth';
import { SessionService } from './session.service';

@Global()
@Module({
  providers: [
    {
      provide: AUTH,
      inject: [ENV, DB, REDIS, EMAIL_QUEUE],
      useFactory: (env: ApiEnv, db: DbClient, redis: Redis, emailQueue: EmailQueue) =>
        createAuth({ env, db, redis, emailQueue }),
    },
    SessionService,
  ],
  exports: [AUTH, SessionService],
})
export class AuthModule {}
