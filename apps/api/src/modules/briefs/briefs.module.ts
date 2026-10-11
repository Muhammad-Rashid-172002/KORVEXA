import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { BriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';

@Module({ imports: [OrdersModule], controllers: [BriefsController], providers: [BriefsService] })
export class BriefsModule {}
