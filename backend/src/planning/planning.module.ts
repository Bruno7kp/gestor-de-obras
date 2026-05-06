import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { BoletosReminderService } from './boletos-reminder.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PlanningController],
  providers: [PlanningService, BoletosReminderService],
})
export class PlanningModule {}
