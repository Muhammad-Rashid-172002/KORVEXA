/**
 * Writes the OpenAPI spec to packages/shared/openapi.json without connecting to any service
 * (Nest preview mode: providers are not instantiated). Placeholder env values satisfy validation only.
 * Usage: pnpm openapi  (also regenerates the typed web client).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const placeholders: Record<string, string> = {
  DATABASE_URL: 'postgres://unused',
  REDIS_URL: 'redis://unused',
  BETTER_AUTH_SECRET: 'openapi-generation-placeholder-secret-0000',
  S3_ENDPOINT: 'http://unused.local',
  S3_PUBLIC_ENDPOINT: 'http://unused.local',
  S3_BUCKET: 'unused',
  S3_ACCESS_KEY_ID: 'unused',
  S3_SECRET_ACCESS_KEY: 'unused',
  LOG_LEVEL: 'error',
};
for (const [k, v] of Object.entries(placeholders)) process.env[k] ??= v;

async function main(): Promise<void> {
  // Loaded after the placeholders above are set (AppModule validates env at import time).
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { NestFactory } = require('@nestjs/core') as typeof import('@nestjs/core');
  const { FastifyAdapter } = require('@nestjs/platform-fastify') as typeof import('@nestjs/platform-fastify');
  const { AppModule } = require('./app.module') as typeof import('./app.module');
  const { buildOpenApiDocument } = require('./openapi-setup') as typeof import('./openapi-setup');
  /* eslint-enable @typescript-eslint/no-require-imports */

  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { preview: true, logger: false });
  app.setGlobalPrefix('v1', { exclude: ['health', 'ready'] });
  const doc = buildOpenApiDocument(app);
  const out = path.resolve(__dirname, '../../../packages/shared/openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  console.warn(`✓ wrote ${out}`);
  await app.close();
}

void main();
