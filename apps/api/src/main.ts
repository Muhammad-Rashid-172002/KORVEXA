import './instrument';
import { assertNoSeedData } from '@glasswork/db';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') await assertNoSeedData(env.DATABASE_URL);
  const app = await createApp();
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
