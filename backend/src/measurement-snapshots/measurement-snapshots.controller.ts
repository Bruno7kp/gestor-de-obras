import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MeasurementSnapshotsService } from './measurement-snapshots.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateSnapshotBody {
  projectId: string;
  measurementNumber: number;
  date: string;
  itemsSnapshot: unknown;
  totals: unknown;
}

type UpdateSnapshotBody = Partial<CreateSnapshotBody>;

@Controller('measurement-snapshots')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class MeasurementSnapshotsController {
  constructor(private readonly snapshotsService: MeasurementSnapshotsService) {}

  @Get()
  @HasPermission('period_close.view', 'period_close.edit')
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.snapshotsService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('period_close.edit')
  create(@Body() body: CreateSnapshotBody, @Req() req: AuthenticatedRequest) {
    return this.snapshotsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id')
  @HasPermission('period_close.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateSnapshotBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.snapshotsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('period_close.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.snapshotsService.remove(id, req.user.instanceId, req.user.id);
  }
}
