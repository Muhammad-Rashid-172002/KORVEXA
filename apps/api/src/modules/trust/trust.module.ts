import { Global, Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { OrdersModule } from '../orders/orders.module';
import { ModerationController } from './moderation.controller';
import { ReportsService } from './reports.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SellerStatsService } from './stats.service';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';

@Global()
@Module({
  imports: [OrdersModule, FilesModule],
  controllers: [ReviewsController, VerificationsController, ModerationController],
  providers: [SellerStatsService, ReviewsService, VerificationsService, ReportsService],
  exports: [SellerStatsService],
})
export class TrustModule {}
