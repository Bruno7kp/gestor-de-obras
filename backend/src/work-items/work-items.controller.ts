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
    return this.workItemsService.findAll(projectId, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateWorkItemBody, @Req() req: AuthenticatedRequest) {
    return this.workItemsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateWorkItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workItemsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workItemsService.remove(id, req.user.instanceId);
  }
}
