import { Module } from '@nestjs/common';
import { StockRequestsController } from './stock-requests.controller';
import { StockRequestsService } from './stock-requests.service';
import { GlobalStockModule } from '../global-stock/global-stock.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [GlobalStockModule, NotificationsModule],
  controllers: [StockRequestsController],
  providers: [StockRequestsService],
})
export class StockRequestsModule {}
