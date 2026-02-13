import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InstancesModule } from './instances/instances.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { ProjectsModule } from './projects/projects.module';
import { ProjectGroupsModule } from './project-groups/project-groups.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { WorkItemsModule } from './work-items/work-items.module';
import { ProjectExpensesModule } from './project-expenses/project-expenses.module';
import { PlanningModule } from './planning/planning.module';
import { JournalModule } from './journal/journal.module';
import { ProjectAssetsModule } from './project-assets/project-assets.module';
import { MeasurementSnapshotsModule } from './measurement-snapshots/measurement-snapshots.module';
import { WorkforceModule } from './workforce/workforce.module';
import { BiddingsModule } from './biddings/biddings.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { GlobalSettingsModule } from './global-settings/global-settings.module';
import { RolesGuard } from './auth/roles.guard';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { UploadsModule } from './uploads/uploads.module';
import { LaborContractsModule } from './labor-contracts/labor-contracts.module';
import { DebugModule } from './debug/debug.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    InstancesModule,
    UsersModule,
    MailModule,
    ProjectsModule,
    ProjectGroupsModule,
    ProjectMembersModule,
    WorkItemsModule,
    ProjectExpensesModule,
    PlanningModule,
    JournalModule,
    ProjectAssetsModule,
    MeasurementSnapshotsModule,
    WorkforceModule,
    BiddingsModule,
    SuppliersModule,
    GlobalSettingsModule,
    RolesModule,
    PermissionsModule,
    UploadsModule,
    LaborContractsModule,
    DebugModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
