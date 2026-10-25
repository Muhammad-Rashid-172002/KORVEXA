import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [FilesModule, PaymentsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
