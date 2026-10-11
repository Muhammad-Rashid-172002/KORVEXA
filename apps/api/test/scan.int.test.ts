import { eq, files, type DbClient } from '@glasswork/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB } from '../src/infra/tokens';
import { createFile, createTestApp, makeCaller, signUpVerified, type TestUser } from './helpers';

const TOKEN = 'dev-only-internal-token-change-me-0123456789';

describe('file scan verdicts (worker → API)', () => {
  let app: NestFastifyApplication;
  let call: ReturnType<typeof makeCaller>;
  let owner: TestUser;
  const json = <T>(r: { json: () => unknown }) => r.json() as T;
  const status = async (id: string) => {
    const [f] = await app
      .get<DbClient>(DB)
      .db.select({ s: files.status })
      .from(files)
      .where(eq(files.id, id));
    return f?.s;
  };
  const verdict = (id: string, body: unknown, token: string | null = TOKEN) =>
    call(null, 'POST', `/internal/files/${id}/scan-result`, body, token ? { 'x-internal-token': token } : {});

  beforeAll(async () => {
    app = await createTestApp();
    call = makeCaller(app);
    owner = await signUpVerified(app, { name: 'Uploader' });
  });
  afterAll(async () => {
    await app?.close();
  });

  it('needs the shared internal token', async () => {
    const id = await createFile(app, owner, 'deliverable', { status: 'uploaded' });
    expect((await verdict(id, { status: 'clean' }, null)).statusCode).toBe(403);
    expect((await verdict(id, { status: 'clean' }, 'wrong-token-wrong-token-wrong')).statusCode).toBe(403);
    expect(await status(id)).toBe('uploaded');
  });

  it('uploaded files are not downloadable until a clean verdict arrives', async () => {
    const id = await createFile(app, owner, 'deliverable', { status: 'uploaded' });
    expect((await call(owner, 'GET', `/me/files/${id}`)).statusCode).toBe(200);
    expect(
      json<{ downloadUrl: string | null }>(await call(owner, 'GET', `/me/files/${id}`)).downloadUrl,
    ).toBeNull();
    expect((await call(owner, 'GET', `/files/${id}/download`)).statusCode).toBe(404);

    expect(json<{ applied: boolean }>(await verdict(id, { status: 'clean' }))).toMatchObject({
      applied: true,
      status: 'clean',
    });
    expect(await status(id)).toBe('clean');
    expect((await call(owner, 'GET', `/files/${id}/download`)).statusCode).toBe(200);
  });

  it('infected files are blocked for good; verdicts are final and idempotent', async () => {
    const id = await createFile(app, owner, 'deliverable', { status: 'uploaded' });
    expect(
      json<{ applied: boolean }>(
        await verdict(id, { status: 'infected', signature: 'Eicar-Test-Signature' }),
      ),
    ).toMatchObject({ applied: true });
    expect(await status(id)).toBe('infected');
    // A later "clean" cannot resurrect it, and replays change nothing.
    expect(json<{ applied: boolean; status: string }>(await verdict(id, { status: 'clean' }))).toEqual({
      applied: false,
      status: 'infected',
    });
    expect(await status(id)).toBe('infected');
    expect((await call(owner, 'GET', `/files/${id}/download`)).statusCode).toBe(404);
    const logs = json<{ items: unknown[] }>(await call(owner, 'GET', '/me/files'));
    expect(logs.items.length).toBeGreaterThan(0);
  });

  it('validates the verdict body and the file id', async () => {
    const id = await createFile(app, owner, 'deliverable', { status: 'uploaded' });
    expect((await verdict(id, { status: 'maybe' })).statusCode).toBe(400);
    expect((await verdict('not-a-uuid', { status: 'clean' })).statusCode).toBeGreaterThanOrEqual(400);
    expect((await verdict('00000000-0000-7000-8000-000000000000', { status: 'clean' })).statusCode).toBe(404);
  });
});
