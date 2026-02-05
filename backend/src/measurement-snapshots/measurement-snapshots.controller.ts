import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MeasurementSnapshotsService } from './measurement-snapshots.service';
import { Roles } from '../auth/roles.decorator';

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
  findAll(@Query('projectId') projectId: string, @Req() req: any) {
    return this.snapshotsService.findAll(projectId, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateSnapshotBody, @Req() req: any) {
    return this.snapshotsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSnapshotBody, @Req() req: any) {
    return this.snapshotsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.snapshotsService.remove(id, req.user.instanceId);
  }
}
