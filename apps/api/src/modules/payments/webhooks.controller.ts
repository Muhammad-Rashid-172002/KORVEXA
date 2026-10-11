import { Controller, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../common/policy/decorators';
import { PaymentsProvider } from './payments.provider';
import { PaymentsService } from './payments.service';

/** Provider webhooks. Authenticated by signature only (never by session); the raw body is verified before anything is trusted. */
@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly provider: PaymentsProvider,
  ) {}

  @Public()
  @Post(':provider')
  async receive(@Param('provider') provider: string, @Req() req: FastifyRequest & { rawBody?: Buffer }) {
    if (provider !== this.provider.name) throw new NotFoundException();
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.processWebhook(raw, req.headers);
  }
}
