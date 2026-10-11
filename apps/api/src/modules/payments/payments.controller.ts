import { payoutRequestSchema } from '@glasswork/shared';
import { Body, Controller, Get, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy, Public } from '../../common/policy/decorators';
import { FeesService } from './fees.service';
import { IdempotencyService } from './idempotency.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

class PaymentParamDto extends createZodDto(z.object({ paymentId: z.uuid() })) {}
class InvoiceParamDto extends createZodDto(z.object({ invoiceId: z.uuid() })) {}
class SimulateDto extends createZodDto(z.object({ outcome: z.enum(['succeeded', 'failed']) })) {}
class PayoutRequestDto extends createZodDto(payoutRequestSchema) {}
class QuoteQueryDto extends createZodDto(
  z.object({ amount: z.coerce.number().int().min(0).max(100_000_000) }),
) {}

@ApiTags('payments')
@ApiExcludeController()
@ApiCookieAuth()
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly payouts: PayoutsService,
    private readonly fees: FeesService,
    private readonly idem: IdempotencyService,
  ) {}

  @Public()
  @Get('fees/quote')
  quote(@Query() q: QuoteQueryDto) {
    return this.fees.quote(q.amount);
  }

  @Policy('only the payer reads their payment')
  @Get('payments/:paymentId')
  get(@CurrentActor() a: RequestActor, @Param() p: PaymentParamDto) {
    return this.payments.getPayment(a, p.paymentId);
  }

  @Policy('only the payer completes their own simulated checkout; unavailable with a real provider')
  @Post('payments/:paymentId/simulate')
  simulate(@CurrentActor() a: RequestActor, @Param() p: PaymentParamDto, @Body() b: SimulateDto) {
    return this.payments.simulate(a, p.paymentId, b.outcome);
  }

  @Policy('lists only the caller’s invoices')
  @Get('me/invoices')
  invoices(@CurrentActor() a: RequestActor) {
    return this.payouts.listInvoices(a);
  }

  @Policy('only the invoice owner downloads the PDF; others get 404')
  @Get('invoices/:invoiceId/pdf')
  async invoicePdf(@CurrentActor() a: RequestActor, @Param() p: InvoiceParamDto, @Res() res: FastifyReply) {
    const { filename, bytes } = await this.payouts.invoicePdf(a, p.invoiceId);
    await res
      .header('content-type', 'application/pdf')
      .header('content-disposition', `attachment; filename="${filename}"`)
      .header('cache-control', 'private, no-store')
      .send(Buffer.from(bytes));
  }

  @Policy('a seller reads only their own balances', ['seller'])
  @Get('me/earnings')
  earnings(@CurrentActor() a: RequestActor) {
    return this.payouts.earnings(a);
  }

  @Policy('a seller requests a payout only from their own available balance', ['seller'])
  @Post('me/payouts')
  async requestPayout(
    @CurrentActor() a: RequestActor,
    @Body() b: PayoutRequestDto,
    @Headers('idempotency-key') key: string | undefined,
  ) {
    const k = this.idem.requireKey(key);
    const { response } = await this.idem.run({ userId: a.userId, scope: 'payout', key: k, body: b }, () =>
      this.payouts.requestPayout(a, b.amount),
    );
    return response;
  }
}
