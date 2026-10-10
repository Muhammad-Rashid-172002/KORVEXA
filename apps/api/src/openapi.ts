/**
 * Writes the OpenAPI spec to packages/shared/openapi.json without connecting to any service.
 * Usage: pnpm --filter @glasswork/api openapi  (also regenerates the typed web client).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { buildOpenApiDocument } from './openapi-setup';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), { preview: true, logger: false });
  app.setGlobalPrefix('v1', { exclude: ['health', 'ready'] });
  const doc = buildOpenApiDocument(app);
  const out = path.resolve(__dirname, '../../../packages/shared/openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  console.warn(`✓ wrote ${out}`);
  await app.close();
}

void main();
