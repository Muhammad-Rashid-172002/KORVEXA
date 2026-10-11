import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AUTH_BASE_PATH, type Auth } from './auth';

/** Converts Fastify request headers to Web `Headers`, pinning X-Forwarded-For to Fastify's resolved client IP. */
export function toWebHeaders(req: FastifyRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, String(value));
  }
  // Never trust a client-sent X-Forwarded-For: Fastify resolves req.ip according to TRUST_PROXY.
  headers.set('x-forwarded-for', req.ip);
  return headers;
}

/** Mounts Better Auth's fetch handler at /v1/auth/* on the raw Fastify instance. */
export function registerAuthRoutes(fastify: FastifyInstance, auth: Auth): void {
  fastify.route({
    method: ['GET', 'POST'],
    url: `${AUTH_BASE_PATH}/*`,
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.headers.host ?? 'localhost'}`);
      const hasBody = request.method !== 'GET' && request.body !== undefined && request.body !== null;
      const webRequest = new Request(url, {
        method: request.method,
        headers: toWebHeaders(request),
        body: hasBody ? JSON.stringify(request.body) : undefined,
      });
      const response = await auth.handler(webRequest);

      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value);
      });
      // Headers.forEach joins multiple Set-Cookie values with commas; send them individually.
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) reply.header('set-cookie', cookies);
      return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null);
    },
  });
}
