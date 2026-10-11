import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id with OWASP-recommended parameters (m=19 MiB, t=2, p=1). DECISIONS D-010.
 * @node-rs/argon2 defaults to the argon2id variant.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);
export const verifyPassword = (hashed: string, password: string): Promise<boolean> =>
  verify(hashed, password).catch(() => false);
