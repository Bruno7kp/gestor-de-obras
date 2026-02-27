import { Module } from '@nestjs/common';
import { PurchaseRequestsController } from './purchase-requests.controller';
import { PurchaseRequestsService } from './purchase-requests.service';
import { GlobalStockModule } from '../global-stock/global-stock.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [GlobalStockModule, NotificationsModule],
  controllers: [PurchaseRequestsController],
  providers: [PurchaseRequestsService],
})
export class PurchaseRequestsModule {}
