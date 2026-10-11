import { SETTING_KEYS, feeSettingsSchema, payoutDecisionSchema, reasonSchema } from '@glasswork/shared';
import { auditLogs, platformSettings, sql, type DbClient } from '@glasswork/db';
import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { DB } from '../../infra/tokens';
import { MilestonesService } from '../orders/milestones.service';
import { FeesService } from './fees.service';
import { LedgerService } from './ledger.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

class IdDto extends createZodDto(z.object({ id: z.uuid() })) {}
class DecisionDto extends createZodDto(payoutDecisionSchema) {}
class ReasonDto extends createZodDto(reasonSchema) {}
class FeeSettingsDto extends createZodDto(feeSettingsSchema) {}
class PayoutQueryDto extends createZodDto(
  z.object({ status: z.enum(['requested', 'processing', 'paid', 'failed']).optional() }),
) {}
class WebhookQueryDto extends createZodDto(z.object({ failed: z.enum(['true', 'false']).optional() })) {}

/** Money admin tools: fee settings, payouts, webhook replay, refunds, ledger health. All mutations are audited. */
@ApiExcludeController()
@ApiCookieAuth()
@Controller('admin')
export class AdminPaymentsController {
  constructor(
    private readonly scopes: AdminScopeService,
    private readonly payouts: PayoutsService,
    private readonly payments: PaymentsService,
    private readonly milestones: MilestonesService,
    private readonly fees: FeesService,
    private readonly ledger: LedgerService,
    @Inject(DB) private readonly db: DbClient,
  ) {}

  @Policy('admin role required to read fee settings', ['admin'])
  @Get('settings/fees')
  async getFees() {
    return { ...(await this.fees.settings()), autoApproveDays: await this.fees.autoApproveDays() };
  }

  @Policy('only product admins change fee settings (audited)', ['admin'])
  @Put('settings/fees')
  async setFees(@CurrentActor() a: RequestActor, @Body() b: FeeSettingsDto) {
    await this.scopes.require(a, ['product']);
    const before = { ...(await this.fees.settings()), autoApproveDays: await this.fees.autoApproveDays() };
    const entries: [string, number][] = [
      [SETTING_KEYS.buyerServiceFeeBps, b.buyerServiceBps],
      [SETTING_KEYS.buyerServiceFeeMinAmount, b.buyerServiceMin],
      [SETTING_KEYS.sellerCommissionBps, b.sellerCommissionBps],
      [SETTING_KEYS.sellerCommissionMinAmount, b.sellerCommissionMin],
      [SETTING_KEYS.autoApproveDays, b.autoApproveDays],
    ];
    await this.db.db.transaction(async (tx) => {
      for (const [key, value] of entries) {
        await tx
          .insert(platformSettings)
          .values({ key, value, updatedBy: a.userId })
          .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: a.userId } });
      }
      await tx.insert(auditLogs).values({
        actorId: a.userId,
        action: 'settings.fees_changed',
        entityType: 'platform_settings',
        entityId: 'fees',
        before,
        after: b,
      });
    });
    return b;
  }

  @Policy('admin role required to list payouts', ['admin'])
  @Get('payouts')
  listPayouts(@Query() q: PayoutQueryDto) {
    return this.payouts.adminList(q.status);
  }

  @Policy('operations or product admins mark manual payouts as paid', ['admin'])
  @Post('payouts/:id/mark-paid')
  async markPaid(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: DecisionDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.payouts.decide(a, p.id, 'paid', b.reference, b.note);
  }

  @Policy('operations or product admins mark manual payouts as failed (balance returns to the seller)', [
    'admin',
  ])
  @Post('payouts/:id/mark-failed')
  async markFailed(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: DecisionDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.payouts.decide(a, p.id, 'failed', undefined, b.note);
  }

  @Policy('admin role required to read webhook events', ['admin'])
  @Get('webhook-events')
  webhookEvents(@Query() q: WebhookQueryDto) {
    return this.payments.listWebhookEvents(q.failed === 'true');
  }

  @Policy('operations or product admins replay stored webhook events (idempotent)', ['admin'])
  @Post('webhook-events/:id/replay')
  async replay(@CurrentActor() a: RequestActor, @Param() p: IdDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.payments.replay(p.id);
  }

  @Policy('operations or product admins refund a funded milestone, with a reason', ['admin'])
  @Post('milestones/:id/refund')
  async refund(@CurrentActor() a: RequestActor, @Param() p: IdDto, @Body() b: ReasonDto) {
    await this.scopes.require(a, ['operations', 'product']);
    return this.milestones.adminRefund(a, p.id, b.reason);
  }

  @Policy('admin role required to read ledger health', ['admin'])
  @Get('ledger/summary')
  async ledgerSummary() {
    const [escrow] = await this.db.db
      .execute<{ total: string }>(
        sql`select coalesce(-sum(e.amount), 0)::text as total from ledger_entries e join ledger_accounts a on a.id = e.account_id where a.code like 'escrow:%'`,
      )
      .then((r) => r.rows);
    const [payable] = await this.db.db
      .execute<{ total: string }>(
        sql`select coalesce(-sum(e.amount), 0)::text as total from ledger_entries e join ledger_accounts a on a.id = e.account_id where a.code like 'seller_payable:%'`,
      )
      .then((r) => r.rows);
    return {
      trialBalance: await this.ledger.trialBalance(),
      cash: await this.ledger.rawBalance('platform_cash'),
      revenue: await this.ledger.creditBalance('platform_revenue'),
      payoutClearing: await this.ledger.creditBalance('payout_clearing'),
      escrow: Number(escrow?.total ?? 0),
      sellerPayable: Number(payable?.total ?? 0),
    };
  }
}
