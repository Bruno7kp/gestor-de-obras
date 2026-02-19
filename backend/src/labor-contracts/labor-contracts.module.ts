import { Module } from '@nestjs/common';
import { LaborContractsController } from './labor-contracts.controller';
import { LaborContractsService } from './labor-contracts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [LaborContractsController],
  providers: [LaborContractsService],
})
export class LaborContractsModule {}
