import { Module } from '@nestjs/common';
import { ENV, type ApiEnv } from '../../config/env';
import { OrdersModule } from '../orders/orders.module';
import { CodeActivityController, GithubWebhookController } from './code-activity.controller';
import { CodeActivityService } from './code-activity.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { DailyVideoProvider, StubVideoProvider, VideoProvider } from './video.provider';

@Module({
  imports: [OrdersModule],
  controllers: [MeetingsController, CodeActivityController, GithubWebhookController],
  providers: [
    {
      provide: VideoProvider,
      inject: [ENV],
      useFactory: (env: ApiEnv): VideoProvider =>
        env.VIDEO_PROVIDER === 'daily' ? new DailyVideoProvider(env) : new StubVideoProvider(env),
    },
    MeetingsService,
    CodeActivityService,
  ],
})
export class MeetingsModule {}
