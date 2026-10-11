import { createServer, type Server, type Socket } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { ClamdError, scanStream } from './clamd';

/** A protocol-faithful fake clamd: parses zINSTREAM framing and answers by content (EICAR marker → FOUND). */
function fakeClamd(
  reply?: (received: Buffer) => string | null,
): Promise<{ server: Server; port: number; received: Buffer[] }> {
  const received: Buffer[] = [];
  return new Promise((resolve) => {
    const server = createServer((sock: Socket) => {
      let buf = Buffer.alloc(0);
      let started = false;
      const payload: Buffer[] = [];
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        if (!started) {
          const nul = buf.indexOf(0);
          if (nul < 0) return;
          expect(buf.subarray(0, nul).toString()).toBe('zINSTREAM');
          buf = buf.subarray(nul + 1);
          started = true;
        }
        for (;;) {
          if (buf.length < 4) return;
          const len = buf.readUInt32BE(0);
          if (len === 0) {
            const all = Buffer.concat(payload);
            received.push(all);
            const custom = reply?.(all);
            if (custom === null) return sock.destroy();
            sock.end(
              custom ??
                (all.toString().includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')
                  ? 'stream: Eicar-Test-Signature FOUND\0'
                  : 'stream: OK\0'),
            );
            return;
          }
          if (buf.length < 4 + len) return;
          payload.push(buf.subarray(4, 4 + len));
          buf = buf.subarray(4 + len);
        }
      });
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, port: (server.address() as { port: number }).port, received }),
    );
  });
}

let open: Server | undefined;
afterEach(() => open?.close());
const run = async (data: Readable, reply?: (b: Buffer) => string | null, chunkBytes?: number) => {
  const f = await fakeClamd(reply);
  open = f.server;
  return {
    verdict: scanStream(data, { host: '127.0.0.1', port: f.port, timeoutMs: 2000, chunkBytes }),
    received: f.received,
  };
};

describe('clamd INSTREAM client', () => {
  it('reports clean files', async () => {
    const { verdict, received } = await run(Readable.from([Buffer.from('hello world')]));
    expect(await verdict).toEqual({ status: 'clean' });
    expect(received[0]!.toString()).toBe('hello world');
  });

  it('reports the signature for infected files (EICAR)', async () => {
    const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const { verdict } = await run(Readable.from([Buffer.from(eicar)]));
    expect(await verdict).toEqual({ status: 'infected', signature: 'Eicar-Test-Signature' });
  });

  it('frames large inputs in chunks and reassembles them exactly', async () => {
    const big = Buffer.alloc(300_000, 7);
    const { verdict, received } = await run(
      Readable.from([big.subarray(0, 100_000), big.subarray(100_000)]),
      undefined,
      40_000,
    );
    expect(await verdict).toEqual({ status: 'clean' });
    expect(received[0]!.equals(big)).toBe(true);
  });

  it('treats ERROR replies, odd replies and dropped connections as failures (never as clean)', async () => {
    await expect(
      (await run(Readable.from([Buffer.from('x')]), () => 'INSTREAM size limit exceeded. ERROR\0')).verdict,
    ).rejects.toBeInstanceOf(ClamdError);
    open?.close();
    await expect((await run(Readable.from([Buffer.from('x')]), () => '')).verdict).rejects.toThrow(
      /unexpected clamd reply/,
    );
    open?.close();
    await expect((await run(Readable.from([Buffer.from('x')]), () => null)).verdict).rejects.toBeInstanceOf(
      ClamdError,
    );
  });

  it('fails when the daemon is unreachable', async () => {
    await expect(
      scanStream(Readable.from([Buffer.from('x')]), { host: '127.0.0.1', port: 1, timeoutMs: 500 }),
    ).rejects.toBeInstanceOf(ClamdError);
  });
});
