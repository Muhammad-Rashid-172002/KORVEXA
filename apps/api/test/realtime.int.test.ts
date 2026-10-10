import type { ClientToServerEvents, ServerToClientEvents } from '@glasswork/shared';
import { SOCKET_PATH } from '@glasswork/shared';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, signUpVerified } from './helpers';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

describe('authenticated Socket.io connection', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  const connect = (headers: Record<string, string> = {}, auth?: Record<string, string>): ClientSocket => {
    const s: ClientSocket = io(baseUrl, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      extraHeaders: headers,
      auth,
      reconnection: false,
      forceNew: true,
    });
    sockets.push(s);
    return s;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = await app.getUrl();
    baseUrl = baseUrl.replace('[::1]', '127.0.0.1');
  });
  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  });

  it('rejects a socket without a session', async () => {
    const s = connect();
    const err = await new Promise<Error>((resolve) => s.on('connect_error', resolve));
    expect(err.message).toBe('unauthorized');
    expect(s.connected).toBe(false);
  });

  it('rejects a socket with a forged cookie', async () => {
    const s = connect({ cookie: 'gw.session_token=forged.value' });
    const err = await new Promise<Error>((resolve) => s.on('connect_error', resolve));
    expect(err.message).toBe('unauthorized');
  });

  it('accepts a socket with a valid session cookie and answers ping', async () => {
    const user = await signUpVerified(app);
    const s = connect({ cookie: user.cookie });
    const ready = await new Promise<{ userId: string }>((resolve, reject) => {
      s.on('session:ready', resolve);
      s.on('connect_error', reject);
    });
    expect(ready.userId).toBe(user.userId);

    const ack = await new Promise<{ ok: true; at: string }>((resolve) => s.emit('ping', { echo: 'hi' }, resolve));
    expect(ack.ok).toBe(true);
  });
});
