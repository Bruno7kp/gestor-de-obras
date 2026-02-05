import { Module } from '@nestjs/common';
import { MeasurementSnapshotsController } from './measurement-snapshots.controller';
import { MeasurementSnapshotsService } from './measurement-snapshots.service';

@Module({
  controllers: [MeasurementSnapshotsController],
  providers: [MeasurementSnapshotsService],
})
export class MeasurementSnapshotsModule {}
