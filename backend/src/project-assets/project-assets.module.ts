import { Module } from '@nestjs/common';
import { ProjectAssetsController } from './project-assets.controller';
import { ProjectAssetsService } from './project-assets.service';

@Module({
  controllers: [ProjectAssetsController],
  providers: [ProjectAssetsService],
})
export class ProjectAssetsModule {}
