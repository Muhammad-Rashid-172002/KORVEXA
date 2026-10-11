import { Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../config/env';
import { OrdersModule } from '../orders/orders.module';
import { RoomModule } from '../room/room.module';
import { AiAdminController } from './ai-admin.controller';
import { AiController } from './ai.controller';
import { AiInternalController } from './ai-internal.controller';
import { AiProvider, AnthropicAiProvider, StubAiProvider } from './ai.provider';
import { AiService } from './ai.service';
import { AnalyticsService } from './analytics.service';
import { BriefBuilderService } from './brief-builder.service';
import { MatchingService } from './matching.service';
import { MeetingNotesService } from './meeting-notes.service';
import { ProgressReportsService } from './progress-reports.service';

@Module({
  imports: [OrdersModule, RoomModule],
  controllers: [AiController, AiAdminController, AiInternalController],
  providers: [
    {
      provide: AiProvider,
      inject: [ENV],
      useFactory: (env: ApiEnv): AiProvider =>
        env.AI_PROVIDER === 'anthropic' ? new AnthropicAiProvider(env) : new StubAiProvider(env),
    },
    AiService,
    BriefBuilderService,
    MatchingService,
    ProgressReportsService,
    MeetingNotesService,
    AnalyticsService,
  ],
  exports: [AiService],
})
export class AiModule {}
