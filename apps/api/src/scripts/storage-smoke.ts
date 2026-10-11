/**
 * Storage smoke test: proves the configured S3-compatible storage supports exactly what the app uses —
 * bucket access, presigned PUT with signed content-type/length, CORS for the web origin, HEAD, presigned GET.
 * Runs inside the api container after `pnpm dev:up` (or: pnpm smoke:storage). Exits non-zero on failure.
 */
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env';

async function main(): Promise<void> {
  const env = loadEnv();
  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = env.S3_BUCKET;
  const Key = `smoke/${Date.now()}.txt`;
  const body = new TextEncoder().encode('glasswork storage smoke test');
  const origin = env.WEB_URL;
  const step = (msg: string) => console.warn(`  ✓ ${msg}`);

  console.warn(`Storage smoke test against ${env.S3_ENDPOINT} (bucket ${Bucket})`);

  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch {
    if (!env.S3_AUTO_CREATE_BUCKET) throw new Error(`bucket ${Bucket} is missing and auto-create is off`);
    await s3.send(new CreateBucketCommand({ Bucket }));
  }
  step('bucket reachable with the configured keys');

  const putUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket, Key, ContentType: 'text/plain', ContentLength: body.byteLength }),
    { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) },
  );
  const put = await fetch(putUrl, { method: 'PUT', headers: { 'content-type': 'text/plain', origin }, body });
  if (!put.ok) throw new Error(`presigned PUT failed: ${put.status} ${await put.text()}`);
  step('presigned PUT (signed content-type + content-length) accepted');

  const preflight = await fetch(putUrl, {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'content-type',
    },
  });
  const allowOrigin = preflight.headers.get('access-control-allow-origin');
  if (allowOrigin !== origin && allowOrigin !== '*') {
    throw new Error(
      `CORS preflight from ${origin} not allowed (status ${preflight.status}, allow-origin=${allowOrigin ?? 'none'}). ` +
        'Browser uploads would fail — check the storage CORS setting (RUSTFS_CORS_ALLOWED_ORIGINS).',
    );
  }
  step(`CORS preflight allows ${origin}`);

  const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
  if (head.ContentLength !== body.byteLength || head.ContentType !== 'text/plain') {
    throw new Error(`HEAD mismatch: size=${head.ContentLength} type=${head.ContentType}`);
  }
  step('HEAD returns the declared size and type');

  const getUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
  const got = await fetch(getUrl);
  if (!got.ok || (await got.text()) !== new TextDecoder().decode(body))
    throw new Error(`presigned GET failed: ${got.status}`);
  step('presigned GET returns the object');

  await s3.send(new DeleteObjectCommand({ Bucket, Key }));
  step('cleanup');
  console.warn('✓ Storage works for presigned uploads and downloads.');
}

main().catch((err: unknown) => {
  console.error(`✗ Storage smoke test failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
