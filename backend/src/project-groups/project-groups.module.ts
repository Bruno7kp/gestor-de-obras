import { Module } from '@nestjs/common';
import { ProjectGroupsController } from './project-groups.controller';
import { ProjectGroupsService } from './project-groups.service';

@Module({
  controllers: [ProjectGroupsController],
  providers: [ProjectGroupsService],
})
export class ProjectGroupsModule {}
