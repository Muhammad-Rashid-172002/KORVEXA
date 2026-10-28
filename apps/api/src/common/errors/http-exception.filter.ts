import { ERROR_CODES, InvalidTransitionError, type ApiErrorBody } from '@glasswork/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';

const CODE_BY_STATUS: Record<number, string> = {
  400: ERROR_CODES.validation,
  401: ERROR_CODES.unauthorized,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  409: ERROR_CODES.conflict,
  413: ERROR_CODES.validation,
  429: ERROR_CODES.rateLimited,
  503: 'service_unavailable',
};

function isFastifyClientError(e: unknown): e is { statusCode: number; message: string } {
  if (typeof e !== 'object' || e === null) return false;
  const code = (e as { statusCode?: unknown }).statusCode;
  return (
    typeof code === 'number' &&
    code >= 400 &&
    code < 500 &&
    typeof (e as { message?: unknown }).message === 'string'
  );
}

/** Maps every error to the standard envelope `{ error: { code, message, details?, requestId } }` (D-015). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const req = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong';
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = 400;
      message = 'Request validation failed';
      details = (exception.getZodError() as ZodError).issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
    } else if (exception instanceof InvalidTransitionError) {
      status = 409;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : ((res as { message?: string }).message ?? exception.message);
      if (Array.isArray(message)) message = message.join('; ');
    } else if (isFastifyClientError(exception)) {
      // Errors raised by Fastify plugins (rate limit 429, body too large 413, malformed JSON 400, ...): client errors,
      // not server faults, so they are neither logged as errors nor sent to Sentry.
      status = exception.statusCode;
      message =
        status === 429 ? 'Too many requests. Please slow down and try again shortly.' : exception.message;
    } else {
      this.logger.error(exception);
      Sentry.captureException(exception);
    }

    const body: ApiErrorBody = {
      error: {
        code: CODE_BY_STATUS[status] ?? ERROR_CODES.internal,
        message,
        details,
        requestId: String(req.id),
      },
    };
    void reply.status(status).send(body);
  }
}
