import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DebugController],
})
export class DebugModule {}
