#!/usr/bin/env node
/**
 * Pulls every Docker image the local stack needs, one at a time, with retries and backoff.
 * A slow or dropped download retries on its own instead of aborting `docker compose up`.
 *
 *   pnpm dev:pull            all images (infra services + the Node base image for app builds)
 *   pnpm dev:pull --infra    only the infrastructure services (used by `pnpm dev`)
 *
 * Images already on this machine are skipped, so re-running is cheap.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE = [
  'compose',
  '-f',
  path.join(root, 'infra/docker-compose.yml'),
  '--env-file',
  path.join(root, '.env'),
];
const ATTEMPTS = Number(process.env.PULL_ATTEMPTS ?? 5);
const BACKOFF_S = [5, 15, 30, 60];
const infraOnly = process.argv.includes('--infra');

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// 1. Docker must be running.
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker is not running. Start Docker Desktop, wait for "Engine running", then retry.');
}

// 2. Collect images: compose services that are pulled (not built) + the Dockerfile's base image.
let config;
try {
  config = JSON.parse(
    execFileSync('docker', [...COMPOSE, 'config', '--format', 'json'], { encoding: 'utf8' }),
  );
} catch {
  fail('Could not read infra/docker-compose.yml. Does .env exist? (cp .env.example .env)');
}
const images = Object.values(config.services)
  .filter((s) => s.image && !s.build)
  .map((s) => s.image);
if (!infraOnly) {
  const dockerfile = readFileSync(path.join(root, 'infra/docker/Dockerfile'), 'utf8');
  const base = dockerfile.match(/^ARG NODE_IMAGE=(\S+)/m)?.[1];
  if (base) images.push(base);
}
const unique = [...new Set(images)];

const present = (image) => spawnSync('docker', ['image', 'inspect', image], { stdio: 'ignore' }).status === 0;
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// 3. Pull one by one with retries.
console.log(`Pulling ${unique.length} images (up to ${ATTEMPTS} attempts each):`);
const failed = [];
for (const [i, image] of unique.entries()) {
  const label = `[${i + 1}/${unique.length}] ${image}`;
  if (present(image)) {
    console.log(`✓ ${label} — already downloaded`);
    continue;
  }
  let ok = false;
  for (let attempt = 1; attempt <= ATTEMPTS && !ok; attempt++) {
    console.log(`\n↓ ${label} — attempt ${attempt}/${ATTEMPTS}`);
    const started = Date.now();
    ok = spawnSync('docker', ['pull', image], { stdio: 'inherit' }).status === 0;
    if (ok) {
      console.log(`✓ ${label} — done in ${Math.round((Date.now() - started) / 1000)}s`);
    } else if (attempt < ATTEMPTS) {
      const wait = BACKOFF_S[Math.min(attempt - 1, BACKOFF_S.length - 1)];
      console.log(`… pull failed; retrying in ${wait}s (already-downloaded layers are kept)`);
      await sleep(wait);
    }
  }
  if (!ok) failed.push(image);
}

if (failed.length > 0) {
  console.error(`\n✗ ${failed.length} image(s) could not be downloaded:`);
  for (const image of failed) console.error(`    ${image}\n      retry just this one:  docker pull ${image}`);
  console.error(
    '\n  Then run the same command again (finished downloads are skipped).' +
      '\n  If an image is gone from its registry, see SETUP.md → "An image fails to download".',
  );
  process.exit(1);
}
console.log('\n✓ All images are available locally.\n');
