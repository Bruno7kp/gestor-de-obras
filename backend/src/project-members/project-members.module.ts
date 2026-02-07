import { Module } from '@nestjs/common';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectMembersController],
  providers: [ProjectMembersService],
  exports: [ProjectMembersService],
})
export class ProjectMembersModule {}
