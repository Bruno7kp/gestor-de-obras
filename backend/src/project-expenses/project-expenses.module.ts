import { Module } from '@nestjs/common';
import { ProjectExpensesController } from './project-expenses.controller';
import { ProjectExpensesService } from './project-expenses.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [NotificationsModule, JournalModule],
  controllers: [ProjectExpensesController],
  providers: [ProjectExpensesService],
})
export class ProjectExpensesModule {}
