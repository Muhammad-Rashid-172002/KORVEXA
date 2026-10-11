import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { scanJobSchema } from '@glasswork/shared';
import type { Job } from 'bullmq';
import type { Readable } from 'node:stream';
import { scanStream, type ScanVerdict } from '../clamd';

export interface ScanDeps {
  /** Opens the stored object as a stream. */
  open: (storageKey: string) => Promise<Readable>;
  scan: (data: Readable) => Promise<ScanVerdict>;
  report: (fileId: string, verdict: ScanVerdict) => Promise<void>;
}

/** The worker streams the object to the antivirus and reports the verdict; any failure throws so BullMQ retries. */
export function createScanProcessor(deps: ScanDeps) {
  return async (job: Job): Promise<ScanVerdict> => {
    const { fileId, storageKey } = scanJobSchema.parse(job.data);
    const verdict = await deps.scan(await deps.open(storageKey));
    await deps.report(fileId, verdict);
    return verdict;
  };
}

interface Env {
  API_INTERNAL_URL: string;
  INTERNAL_API_TOKEN: string;
  CLAMD_HOST: string;
  CLAMD_PORT: number;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE: boolean;
}

/** Real wiring: S3 object → clamd → API internal route. */
export function createScanDeps(env: Env, fetchFn: typeof fetch = fetch): ScanDeps {
  const s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return {
    open: async (key) => {
      const out = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return out.Body as Readable;
    },
    scan: (data) => scanStream(data, { host: env.CLAMD_HOST, port: env.CLAMD_PORT }),
    report: async (fileId, verdict) => {
      const res = await fetchFn(`${env.API_INTERNAL_URL}/v1/internal/files/${fileId}/scan-result`, {
        method: 'POST',
        headers: { 'x-internal-token': env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
        body: JSON.stringify(verdict),
      });
      if (!res.ok) throw new Error(`API responded ${res.status} for scan result of ${fileId}`);
    },
  };
}
