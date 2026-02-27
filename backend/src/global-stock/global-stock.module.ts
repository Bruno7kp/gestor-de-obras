import { Module } from '@nestjs/common';
import { GlobalStockController } from './global-stock.controller';
import { GlobalStockService } from './global-stock.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [GlobalStockController],
  providers: [GlobalStockService],
  exports: [GlobalStockService],
})
export class GlobalStockModule {}
