import { Module } from '@nestjs/common';
import { ProjectAssetsController } from './project-assets.controller';
import { ProjectAssetsService } from './project-assets.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProjectAssetsController],
  providers: [ProjectAssetsService],
})
export class ProjectAssetsModule {}
