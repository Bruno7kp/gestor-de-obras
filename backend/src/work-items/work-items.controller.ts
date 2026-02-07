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
import { WorkItemsService } from './work-items.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateWorkItemBody {
  id?: string;
  projectId: string;
  parentId?: string | null;
  name: string;
  type: string;
  wbs?: string;
  order?: number;
  unit?: string;
  cod?: string;
  fonte?: string;
  contractQuantity?: number;
  unitPrice?: number;
  unitPriceNoBdi?: number;
  contractTotal?: number;
  previousQuantity?: number;
  previousTotal?: number;
  currentQuantity?: number;
  currentTotal?: number;
  currentPercentage?: number;
  accumulatedQuantity?: number;
  accumulatedTotal?: number;
  accumulatedPercentage?: number;
  balanceQuantity?: number;
  balanceTotal?: number;
}

type UpdateWorkItemBody = Partial<CreateWorkItemBody>;

@Controller('work-items')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workItemsService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('wbs.edit')
  create(@Body() body: CreateWorkItemBody, @Req() req: AuthenticatedRequest) {
    return this.workItemsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post('replace')
  @HasPermission('wbs.edit')
  async replace(
    @Body()
    body: { projectId: string; items: CreateWorkItemBody[] },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ created: number }> {
    return this.workItemsService.replaceAll(
      body.projectId,
      body.items,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('batch')
  @HasPermission('wbs.edit')
  async batch(
    @Body()
    body: { projectId: string; items: CreateWorkItemBody[]; replace?: boolean },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ created: number }> {
    return this.workItemsService.batchInsert(
      body.projectId,
      body.items,
      !!body.replace,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('wbs.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateWorkItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workItemsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('wbs.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workItemsService.remove(id, req.user.instanceId, req.user.id);
  }
}
