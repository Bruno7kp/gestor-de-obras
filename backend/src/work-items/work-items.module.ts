import { Module } from '@nestjs/common';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkItemsController],
  providers: [WorkItemsService],
})
export class WorkItemsModule {}
