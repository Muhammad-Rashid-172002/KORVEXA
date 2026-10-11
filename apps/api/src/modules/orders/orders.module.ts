import { Module } from '@nestjs/common';
import { AdminPaymentsController } from '../payments/admin-payments.controller';
import { InternalController } from '../payments/internal.controller';
import { MilestonesService } from './milestones.service';
import { OrdersController } from './orders.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [OrdersController, AdminPaymentsController, InternalController],
  providers: [ProjectsService, MilestonesService],
  exports: [ProjectsService, MilestonesService],
})
export class OrdersModule {}
