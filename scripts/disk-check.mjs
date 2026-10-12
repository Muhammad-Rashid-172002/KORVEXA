// Warns when free disk space on the volume holding this repo drops below the threshold (default 15 GB).
// Exit code stays 0 so it never fails a pipeline; it is a loud warning, not a gate.
import { execFileSync } from 'node:child_process';

const thresholdGb = Number(process.env.MIN_FREE_GB ?? 15);
const out = execFileSync('df', ['-Pk', process.cwd()], { encoding: 'utf8' }).trim().split('\n').at(-1);
const freeKb = Number(out.split(/\s+/)[3]);
const freeGb = freeKb / 1024 / 1024;
if (freeGb < thresholdGb) {
  console.warn(
    `\n⚠️  LOW DISK SPACE: ${freeGb.toFixed(1)} GB free (warning below ${thresholdGb} GB).\n` +
      '   Run `pnpm dev:clean` (trims Docker build cache), then empty the Trash or delete large files.\n',
  );
} else {
  console.log(`Disk OK: ${freeGb.toFixed(1)} GB free.`);
}
