import { auditLogs, filesRepository, sql, type DbClient } from '@glasswork/db';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { uuidv7 } from 'uuidv7';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RouteAuditService } from '../src/common/policy/route-audit.service';
import { DB } from '../src/infra/tokens';
import { createTestApp, ORIGIN, signUpVerified } from './helpers';

/**
 * Policy tests for the Phase 0 protected endpoint GET /v1/me/files/:id (brief §5 Authorization):
 * owner → 200, another user → 404 (no existence leak), anonymous → 401.
 */
describe('authorization policies', () => {
  let app: NestFastifyApplication;
  let alice: Awaited<ReturnType<typeof signUpVerified>>;
  let bob: Awaited<ReturnType<typeof signUpVerified>>;
  let aliceFileId: string;

  beforeAll(async () => {
    app = await createTestApp();
    alice = await signUpVerified(app, { name: 'Alice' });
    bob = await signUpVerified(app, { name: 'Bob' });
    const repo = filesRepository(app.get<DbClient>(DB).db);
    const id = uuidv7();
    await repo.create(
      { userId: alice.userId },
      {
        id,
        storageKey: `u/${alice.userId}/${id}`,
        originalName: 'spec.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        purpose: 'portfolio',
        status: 'clean',
      },
    );
    aliceFileId = id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('owner can read their file and gets a short-lived download URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/me/files/${aliceFileId}`,
      headers: { cookie: alice.cookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; downloadUrl: string };
    expect(body.id).toBe(aliceFileId);
    expect(body.downloadUrl).toContain(`u/${alice.userId}/${aliceFileId}`);
    expect(body.downloadUrl).toContain('X-Amz-Expires=300');
  });

  it("another user gets 404 for someone else's file (no existence leak)", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/me/files/${aliceFileId}`,
      headers: { cookie: bob.cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('spec.pdf');
  });

  it("another user cannot complete someone else's upload", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/files/${aliceFileId}/complete`,
      headers: { ...ORIGIN, cookie: bob.cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("another user's list never includes the file", async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me/files', headers: { cookie: bob.cookie } });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { items: { id: string }[] }).items.map((f) => f.id)).not.toContain(aliceFileId);
  });

  it('anonymous requests get 401 on protected routes', async () => {
    for (const url of [`/v1/me/files/${aliceFileId}`, '/v1/me/files', '/v1/me']) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
    const presign = await app.inject({
      method: 'POST',
      url: '/v1/files/uploads',
      payload: { purpose: 'avatar', fileName: 'a.png', mimeType: 'image/png', sizeBytes: 10 },
    });
    expect(presign.statusCode).toBe(401);
  });

  it('presign validates type/size against the purpose allow-list and scopes keys to the user', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/v1/files/uploads',
      headers: { ...ORIGIN, cookie: bob.cookie },
      payload: { purpose: 'avatar', fileName: 'x.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toMatchObject({ error: { code: 'validation_failed' } });

    const ok = await app.inject({
      method: 'POST',
      url: '/v1/files/uploads',
      headers: { ...ORIGIN, cookie: bob.cookie },
      payload: { purpose: 'avatar', fileName: 'me.png', mimeType: 'image/png', sizeBytes: 1234 },
    });
    expect(ok.statusCode).toBe(201);
    const body = ok.json() as { file: { status: string }; upload: { url: string } };
    expect(body.file.status).toBe('pending');
    expect(body.upload.url).toContain(`/u/${bob.userId}/`);
    expect(body.upload.url).toMatch(/X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost/);
  });

  it('every route and socket handler declares an access policy', () => {
    expect(app.get(RouteAuditService).findUndeclared()).toEqual([]);
  });

  it('audit_logs is append-only at the database level', async () => {
    const { db } = app.get<DbClient>(DB);
    await db.insert(auditLogs).values({ action: 'test.event', entityType: 'test' });
    await expect(db.execute(sql`delete from audit_logs where action = 'test.event'`)).rejects.toThrow();
    await expect(db.execute(sql`update audit_logs set action = 'x'`)).rejects.toThrow();
  });

  it('errors use the standard envelope with a request id', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: { 'x-request-id': 'req-123' } });
    expect(res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in required', requestId: 'req-123' },
    });
  });
});

describe('CORS', () => {
  it('allows PATCH/PUT/DELETE preflights from the web origin with credentials, and refuses other origins', async () => {
    const app = await createTestApp();
    try {
      for (const method of ['PATCH', 'PUT', 'DELETE']) {
        const res = await app.inject({
          method: 'OPTIONS',
          url: '/v1/me/mode',
          headers: { ...ORIGIN, 'access-control-request-method': method },
        });
        expect(res.headers['access-control-allow-methods']).toContain(method);
        expect(res.headers['access-control-allow-origin']).toBe(ORIGIN.origin);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
      }
      const evil = await app.inject({
        method: 'OPTIONS',
        url: '/v1/me/mode',
        headers: { origin: 'https://evil.example', 'access-control-request-method': 'PATCH' },
      });
      expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
