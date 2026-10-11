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
  429: ERROR_CODES.rateLimited,
  503: 'service_unavailable',
};

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
