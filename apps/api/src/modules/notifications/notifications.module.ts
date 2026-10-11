import { Global, Module } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import { ProjectNotifier } from './project-notifier.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ENV, type ApiEnv } from '../../config/env';
import { PushSender, WebPushSender } from './push.sender';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    RealtimeService,
    NotificationsService,
    ProjectNotifier,
    { provide: PushSender, inject: [ENV], useFactory: (env: ApiEnv): PushSender => new WebPushSender(env) },
  ],
  exports: [RealtimeService, NotificationsService, ProjectNotifier, PushSender],
})
export class NotificationsModule {}
