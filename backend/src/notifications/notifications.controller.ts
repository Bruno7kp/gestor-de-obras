import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

interface UpsertPreferenceBody {
  projectId?: string | null;
  category: string;
  eventType?: string;
  channelInApp?: boolean;
  channelEmail?: boolean;
  frequency?: 'immediate' | 'digest' | 'off';
  minPriority?: 'low' | 'normal' | 'high' | 'critical';
  isEnabled?: boolean;
}

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @HasPermission('notifications.view', 'notifications.edit')
  list(
    @Query('projectId') projectId: string | undefined,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.listForUser(
      req.user.id,
      req.user.instanceId,
      projectId,
      unreadOnly === 'true',
      Number(limit) || 50,
    );
  }

  @Patch(':id/read')
  @HasPermission('notifications.view', 'notifications.edit')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markRead(
      id,
      req.user.id,
      req.user.instanceId,
    );
  }

  @Patch('read-all')
  @HasPermission('notifications.view', 'notifications.edit')
  markAllRead(
    @Body() body: { projectId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAllRead(
      req.user.id,
      req.user.instanceId,
      body.projectId,
    );
  }

  @Get('preferences')
  @HasPermission('notifications.view', 'notifications.edit')
  listPreferences(
    @Query('projectId') projectId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.listPreferences(
      req.user.id,
      req.user.instanceId,
      projectId,
    );
  }

  @Get('digest-preview')
  @HasPermission('notifications.view', 'notifications.edit')
  digestPreview(
    @Query('projectId') projectId: string | undefined,
    @Query('windowMinutes') windowMinutes: string | undefined,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Query('limitGroups') limitGroups: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.getDigestPreview(
      req.user.id,
      req.user.instanceId,
      {
        projectId,
        windowMinutes: windowMinutes ? Number(windowMinutes) : undefined,
        unreadOnly: unreadOnly === 'true',
        limitGroups: limitGroups ? Number(limitGroups) : undefined,
      },
    );
  }

  @Put('preferences')
  @HasPermission('notifications.edit')
  upsertPreference(
    @Body() body: UpsertPreferenceBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.upsertPreference({
      ...body,
      userId: req.user.id,
      instanceId: req.user.instanceId,
    });
  }

  @Post('process-deliveries')
  @HasPermission('notifications.edit')
  processDeliveries(@Body() body: { limit?: number }) {
    return this.notificationsService.processPendingEmailDeliveries(
      body.limit ?? 100,
    );
  }
}
