import { inject } from 'vitest';

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: 'warn',
  DATABASE_URL: inject('databaseUrl'),
  REDIS_URL: inject('redisUrl'),
  API_PUBLIC_URL: 'http://localhost:4000',
  WEB_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123456',
  AUTH_RATE_LIMIT_ENABLED: process.env.AUTH_RATE_LIMIT_ENABLED ?? 'false',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'glasswork-test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  S3_AUTO_CREATE_BUCKET: 'false',
  API_DOCS_ENABLED: 'false',
  RATE_LIMIT_PER_MINUTE: '10000',
});
