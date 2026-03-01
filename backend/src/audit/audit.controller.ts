import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(AuthGuard('jwt'))
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @HasPermission('audit.view')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('model') model?: string,
    @Query('entityId') entityId?: string,
    @Query('projectId') projectId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.auditService.list({
      instanceId: req.user.instanceId,
      model,
      entityId,
      projectId,
      userId,
      action,
      page: page ? parseInt(page, 10) : undefined,
      limit: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  @HasPermission('audit.view')
  async findById(@Param('id') id: string) {
    return this.auditService.findById(id);
  }
}
