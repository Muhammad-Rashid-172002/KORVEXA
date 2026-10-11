import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';

@Module({
  imports: [FilesModule],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
