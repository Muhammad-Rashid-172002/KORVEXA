import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AdminServicesController } from './admin-services.controller';
import { PostgresSearchService, SearchService } from './search.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [FilesModule],
  controllers: [ServicesController, AdminServicesController],
  providers: [ServicesService, { provide: SearchService, useClass: PostgresSearchService }],
  exports: [ServicesService],
})
export class ServicesModule {}
