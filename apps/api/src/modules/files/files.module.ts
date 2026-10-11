import { Module } from '@nestjs/common';
import { InternalFilesController } from './internal-files.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [FilesController, InternalFilesController],
  providers: [FilesService, StorageService],
  exports: [StorageService],
})
export class FilesModule {}
