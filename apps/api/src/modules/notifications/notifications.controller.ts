import { notificationPrefsSchema, pushSubscriptionSchema } from '@glasswork/shared';
import { Body, Controller, Delete, Get, Headers, Inject, Post, Put, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { RequestActor } from '../../auth/session.service';
import { CurrentActor } from '../../common/policy/auth.guard';
import { Policy } from '../../common/policy/decorators';
import { ENV, type ApiEnv } from '../../config/env';
import { NotificationsService } from './notifications.service';
import { PushSender } from './push.sender';

class ListDto extends createZodDto(
  z.object({ cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }),
) {}
class ReadDto extends createZodDto(z.object({ ids: z.array(z.uuid()).max(100).optional() })) {}
class PrefsDto extends createZodDto(notificationPrefsSchema) {}
class PushSubDto extends createZodDto(pushSubscriptionSchema) {}
class PushUnsubDto extends createZodDto(z.object({ endpoint: z.url().max(1000) })) {}

@ApiExcludeController()
@Controller()
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushSender,
    @Inject(ENV) private readonly env: ApiEnv,
  ) {}

  @Policy('lists only the caller’s notifications')
  @Get('me/notifications')
  list(@CurrentActor() a: RequestActor, @Query() q: ListDto) {
    return this.notifications.list(a.userId, q.cursor, q.limit);
  }

  @Policy('the caller’s own unread count')
  @Get('me/notifications/unread-count')
  async unread(@CurrentActor() a: RequestActor) {
    return { unread: await this.notifications.unreadCount(a.userId) };
  }

  @Policy('marks only the caller’s own notifications read')
  @Post('me/notifications/read')
  read(@CurrentActor() a: RequestActor, @Body() b: ReadDto) {
    return this.notifications.markRead(a.userId, b.ids ?? 'all');
  }

  @Policy('the caller’s own per-type preferences')
  @Get('me/notification-preferences')
  prefs(@CurrentActor() a: RequestActor) {
    return this.notifications.getPreferences(a.userId);
  }

  @Policy('sets only the caller’s own preferences')
  @Put('me/notification-preferences')
  setPrefs(@CurrentActor() a: RequestActor, @Body() b: PrefsDto) {
    return this.notifications.setPreferences(a.userId, b.prefs);
  }

  @Policy('any signed-in user may fetch the public VAPID key')
  @Get('push/public-key')
  publicKey() {
    return { enabled: this.push.enabled, publicKey: this.push.enabled ? this.env.VAPID_PUBLIC_KEY : null };
  }

  @Policy('registers a push subscription for the caller only')
  @Post('me/push-subscriptions')
  subscribe(
    @CurrentActor() a: RequestActor,
    @Body() b: PushSubDto,
    @Headers('user-agent') ua: string | undefined,
  ) {
    return this.notifications.subscribePush(a.userId, b, ua);
  }

  @Policy('removes only the caller’s own push subscription')
  @Delete('me/push-subscriptions')
  unsubscribe(@CurrentActor() a: RequestActor, @Body() b: PushUnsubDto) {
    return this.notifications.unsubscribePush(a.userId, b.endpoint);
  }
}
