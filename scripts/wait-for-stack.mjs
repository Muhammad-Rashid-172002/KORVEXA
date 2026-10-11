#!/usr/bin/env node
// Waits until the local stack answers, runs the storage smoke test, then prints the URLs. Used by `pnpm dev:up`.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  ['API', 'http://localhost:4000/ready'],
  ['Worker', 'http://localhost:4001/'],
  ['Web', 'http://localhost:3000/'],
  ['Mailpit', 'http://localhost:8025/'],
];
const deadline = Date.now() + 5 * 60_000;

async function up(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

for (const [name, url] of targets) {
  process.stdout.write(`… waiting for ${name}`);
  while (!(await up(url))) {
    if (Date.now() > deadline) {
      console.error(`\n✗ ${name} did not become ready at ${url}. Run: pnpm dev:logs`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  process.stdout.write(`\r✓ ${name} ready${' '.repeat(20)}\n`);
}

// Storage smoke test inside the api container (presigned PUT/GET + CORS against RustFS).
const smoke = spawnSync(
  'docker',
  [
    'compose',
    '-f',
    path.join(root, 'infra/docker-compose.yml'),
    '--env-file',
    path.join(root, '.env'),
    'exec',
    '-T',
    'api',
    'node',
    'dist/scripts/storage-smoke.js',
  ],
  { stdio: 'inherit' },
);
if (smoke.status !== 0) {
  console.error(
    '\n✗ Storage smoke test failed (see above). Logs: docker compose -f infra/docker-compose.yml logs rustfs api',
  );
  process.exit(1);
}

console.log(`
  Web        http://localhost:3000
  API        http://localhost:4000      (Swagger: http://localhost:4000/v1/docs)
  Mailpit    http://localhost:8025      (verification emails land here)
  Storage    http://localhost:9001      (RustFS console; log in with S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY from .env)
  Dev users  buyer@ / seller@ / admin@ / support@dev.glasswork.test  ·  password: Glasswork-dev-123!
`);
