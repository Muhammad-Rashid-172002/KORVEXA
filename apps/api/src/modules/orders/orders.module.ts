import { Module } from '@nestjs/common';
import { AdminPaymentsController } from '../payments/admin-payments.controller';
import { InternalController } from '../payments/internal.controller';
import { ChangeRequestsService } from './change-requests.service';
import { DisputesService } from './disputes.service';
import { MilestonesService } from './milestones.service';
import { DisputesController } from './disputes.controller';
import { OrdersController } from './orders.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [OrdersController, DisputesController, AdminPaymentsController, InternalController],
  providers: [ProjectsService, MilestonesService, ChangeRequestsService, DisputesService],
  exports: [ProjectsService, MilestonesService],
})
export class OrdersModule {}
