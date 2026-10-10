import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { IncomingMessage } from 'node:http';
import type { Redis } from 'ioredis';
import { Logger } from 'nestjs-pino';
import { uuidv7 } from 'uuidv7';
import { AppModule } from './app.module';
import type { Auth } from './auth/auth';
import { registerAuthRoutes } from './auth/auth-route';
import { loadEnv } from './config/env';
import { AUTH, REDIS } from './infra/tokens';
import { RedisIoAdapter } from './modules/realtime/redis-io.adapter';
import { setupOpenApi } from './openapi-setup';

/** Builds the fully configured (not yet listening) app. Shared by main.ts and integration tests. */
export async function createApp(opts: { logger?: boolean } = {}): Promise<NestFastifyApplication> {
  const env = loadEnv();
  const adapter = new FastifyAdapter({
    trustProxy: env.TRUST_PROXY,
    requestIdHeader: 'x-request-id',
    genReqId: (raw: IncomingMessage) => {
      const id = (typeof raw.headers['x-request-id'] === 'string' && raw.headers['x-request-id'].slice(0, 64)) || uuidv7();
      (raw as IncomingMessage & { id?: string }).id = id;
      return id;
    },
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
    logger: opts.logger === false ? false : undefined,
  });
  if (opts.logger !== false) app.useLogger(app.get(Logger));

  const corsOrigins = [env.WEB_URL, ...(env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [])];
  const fastify = app.getHttpAdapter().getInstance();

  await app.register(helmet, {
    contentSecurityPolicy: env.API_DOCS_ENABLED ? false : undefined,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  app.enableCors({ origin: corsOrigins, credentials: true, maxAge: 600 });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',
    redis: app.get<Redis>(REDIS),
    nameSpace: 'gw-rl:',
    allowList: (req) => req.url === '/health' || req.url === '/ready',
  });

  registerAuthRoutes(fastify, app.get<Auth>(AUTH));

  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });
  app.useWebSocketAdapter(new RedisIoAdapter(app, env.REDIS_URL, corsOrigins));
  app.enableShutdownHooks();

  if (env.API_DOCS_ENABLED) setupOpenApi(app);
  return app;
}
