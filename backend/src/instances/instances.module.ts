import { Module } from '@nestjs/common';
import { InstancesController } from './instances.controller';
import { InstancesService } from './instances.service';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [RolesModule, UsersModule],
  controllers: [InstancesController],
  providers: [InstancesService],
})
export class InstancesModule {}
