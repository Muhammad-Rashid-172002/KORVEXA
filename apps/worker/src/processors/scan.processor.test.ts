import type { Job } from 'bullmq';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createScanProcessor } from './scan.processor';

const id = '0197c1a0-0000-7000-8000-0000000000aa';
const job = (data: unknown) => ({ data }) as Job;

describe('scan processor', () => {
  it('scans the stored object and reports the verdict to the API', async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(Readable.from(['data']));
    const scan = vi.fn().mockResolvedValue({ status: 'infected', signature: 'Eicar-Test-Signature' });
    const out = await createScanProcessor({ open, scan, report })(
      job({ fileId: id, storageKey: `u/x/${id}` }),
    );
    expect(open).toHaveBeenCalledWith(`u/x/${id}`);
    expect(report).toHaveBeenCalledWith(id, { status: 'infected', signature: 'Eicar-Test-Signature' });
    expect(out.status).toBe('infected');
  });

  it('does not report (so the job retries) when scanning fails', async () => {
    const report = vi.fn();
    const scan = vi.fn().mockRejectedValue(new Error('clamd down'));
    await expect(
      createScanProcessor({ open: vi.fn().mockResolvedValue(Readable.from([])), scan, report })(
        job({ fileId: id, storageKey: 'k' }),
      ),
    ).rejects.toThrow('clamd down');
    expect(report).not.toHaveBeenCalled();
  });

  it('rejects malformed jobs', async () => {
    await expect(
      createScanProcessor({ open: vi.fn(), scan: vi.fn(), report: vi.fn() })(job({ fileId: 'nope' })),
    ).rejects.toThrow();
  });
});
