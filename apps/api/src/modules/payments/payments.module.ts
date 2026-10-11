import { Global, Module } from '@nestjs/common';
import { AdminScopeService } from '../../common/policy/admin-scope.service';
import { ENV, type ApiEnv } from '../../config/env';
import { FeesService } from './fees.service';
import { IdempotencyService } from './idempotency.service';
import { LedgerService } from './ledger.service';
import { PaymentsController } from './payments.controller';
import { PaymentsProvider } from './payments.provider';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { StripePaymentsProvider } from './stripe-payments.provider';
import { TestPaymentsProvider } from './test-payments.provider';
import { WebhooksController } from './webhooks.controller';

@Global()
@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [
    AdminScopeService,
    FeesService,
    IdempotencyService,
    LedgerService,
    PaymentsService,
    PayoutsService,
    {
      provide: PaymentsProvider,
      inject: [ENV],
      useFactory: (env: ApiEnv): PaymentsProvider =>
        env.PAYMENTS_PROVIDER === 'stripe' ? new StripePaymentsProvider(env) : new TestPaymentsProvider(env),
    },
  ],
  exports: [
    AdminScopeService,
    FeesService,
    IdempotencyService,
    LedgerService,
    PaymentsService,
    PayoutsService,
    PaymentsProvider,
  ],
})
export class PaymentsModule {}
