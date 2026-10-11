import { parseEnv, workerEnvSchema, type WorkerEnv } from '@glasswork/shared/env';

export const env: WorkerEnv = parseEnv(workerEnvSchema);
