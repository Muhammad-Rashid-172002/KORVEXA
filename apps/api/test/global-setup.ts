import { runMigrations } from '@glasswork/db';
import { Redis } from 'ioredis';
import type { TestProject } from 'vitest/node';

let stop: (() => Promise<void>) | undefined;

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  let databaseUrl = process.env.TEST_DATABASE_URL;
  let redisUrl = process.env.TEST_REDIS_URL;

  if (!databaseUrl || !redisUrl) {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const { RedisContainer } = await import('@testcontainers/redis');
    const [pg, redis] = await Promise.all([
      new PostgreSqlContainer('postgres:17-alpine').start(),
      new RedisContainer('redis:7.4-alpine').start(),
    ]);
    databaseUrl = pg.getConnectionUri();
    redisUrl = redis.getConnectionUrl();
    stop = async () => {
      await Promise.allSettled([pg.stop(), redis.stop()]);
    };
  } else {
    // Reusing a local database: reset it so runs are repeatable.
    const { Client } = await import('pg');
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(
      'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;',
    );
    await client.end();
  }

  await runMigrations(databaseUrl);
  const redis = new Redis(redisUrl);
  await redis.flushdb();
  await redis.quit();

  project.provide('databaseUrl', databaseUrl);
  project.provide('redisUrl', redisUrl);
  return async () => {
    await stop?.();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}
