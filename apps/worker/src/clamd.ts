import { connect, type Socket } from 'node:net';
import type { Readable } from 'node:stream';

export type ScanVerdict = { status: 'clean' } | { status: 'infected'; signature: string };

export class ClamdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClamdError';
  }
}

interface Options {
  host: string;
  port: number;
  /** Fail the scan if the daemon is silent this long. */
  timeoutMs?: number;
  /** Chunk size sent to clamd; must stay below its StreamMaxLength. */
  chunkBytes?: number;
  connectFn?: (port: number, host: string) => Socket;
}

/**
 * Streams data to a clamd daemon with the `zINSTREAM` command (null-terminated command; chunks framed by a
 * 4-byte big-endian length; a zero-length chunk ends the stream) and parses the one-line reply:
 * `stream: OK` or `stream: <Signature> FOUND`. Anything else (including `ERROR`) is a thrown error so the
 * job is retried instead of a file being waved through.
 */
export async function scanStream(data: Readable, opts: Options): Promise<ScanVerdict> {
  const socket = (opts.connectFn ?? connect)(opts.port, opts.host);
  const chunkBytes = opts.chunkBytes ?? 64 * 1024;
  const reply = new Promise<string>((resolve, reject) => {
    const parts: Buffer[] = [];
    socket.setTimeout(opts.timeoutMs ?? 60_000, () => reject(new ClamdError('clamd timed out')));
    socket.on('data', (d: Buffer) => parts.push(d));
    socket.on('error', (e) => reject(new ClamdError(`clamd connection failed: ${e.message}`)));
    socket.on('close', () => resolve(Buffer.concat(parts).toString('utf8')));
  });
  reply.catch(() => undefined); // surfaced below; avoids an unhandled rejection if we fail while still writing

  const write = (b: Buffer) =>
    new Promise<void>((resolve, reject) => socket.write(b, (e) => (e ? reject(e) : resolve())));
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    await write(Buffer.from('zINSTREAM\0'));
    for await (const raw of data) {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
      for (let i = 0; i < buf.length; i += chunkBytes) {
        const part = buf.subarray(i, i + chunkBytes);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        await write(Buffer.concat([len, part]));
      }
    }
    await write(Buffer.alloc(4)); // end of stream
  } catch (e) {
    socket.destroy();
    throw e instanceof ClamdError ? e : new ClamdError(`clamd write failed: ${(e as Error).message}`);
  }

  const line = (await reply).replace(/\0/g, '').trim();
  const found = /^stream: (.+) FOUND$/.exec(line);
  if (found) return { status: 'infected', signature: found[1]! };
  if (line === 'stream: OK') return { status: 'clean' };
  throw new ClamdError(`unexpected clamd reply: ${line || '(empty)'}`);
}
