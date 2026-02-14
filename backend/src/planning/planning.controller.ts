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
import { PlanningService } from './planning.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateTaskBody {
  id?: string;
  projectId: string;
  categoryId?: string | null;
  description: string;
  status: string;
  isCompleted: boolean;
  dueDate: string;
  createdAt: string;
  completedAt?: string | null;
}

type UpdateTaskBody = Partial<CreateTaskBody>;

interface CreateForecastBody {
  id?: string;
  projectId: string;
  categoryId?: string | null;
  description: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  order?: number;
  supplierId?: string | null;
  paymentProof?: string | null;
  createdById?: string | null;
  supplyGroupId?: string | null;
}

type UpdateForecastBody = Partial<CreateForecastBody>;

interface SupplyGroupItemBody {
  id?: string;
  description: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  categoryId?: string | null;
  order?: number;
}

interface CreateSupplyGroupBody {
  projectId: string;
  title?: string | null;
  supplierId?: string | null;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  paymentProof?: string | null;
  invoiceDoc?: string | null;
  items: SupplyGroupItemBody[];
}

type UpdateSupplyGroupBody = Partial<
  Omit<CreateSupplyGroupBody, 'projectId' | 'items'>
>;

interface ConvertForecastsBody {
  projectId: string;
  forecastIds: string[];
  title?: string | null;
  supplierId?: string | null;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  paymentProof?: string | null;
  invoiceDoc?: string | null;
}

interface CreateMilestoneBody {
  id?: string;
  projectId: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

type UpdateMilestoneBody = Partial<CreateMilestoneBody>;

@Controller('planning')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('tasks')
  listTasks(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listTasks(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('tasks')
  @HasPermission('planning.edit')
  createTask(@Body() body: CreateTaskBody, @Req() req: AuthenticatedRequest) {
    return this.planningService.createTask({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch('tasks/:id')
  @HasPermission('planning.edit')
  updateTask(
    @Param('id') id: string,
    @Body() body: UpdateTaskBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateTask(
      id,
      req.user.instanceId,
      body,
      req.user.id,
    );
  }

  @Delete('tasks/:id')
  @HasPermission('planning.edit')
  deleteTask(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteTask(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Get('forecasts')
  listForecasts(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listForecasts(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Get('supply-groups')
  listSupplyGroups(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listSupplyGroups(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('supply-groups')
  @HasPermission('planning.edit')
  createSupplyGroup(
    @Body() body: CreateSupplyGroupBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.createSupplyGroup({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch('supply-groups/:id')
  @HasPermission('planning.edit')
  updateSupplyGroup(
    @Param('id') id: string,
    @Body() body: UpdateSupplyGroupBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateSupplyGroup(
      id,
      req.user.instanceId,
      body,
      req.user.id,
    );
  }

  @Delete('supply-groups/:id')
  @HasPermission('planning.edit')
  deleteSupplyGroup(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.deleteSupplyGroup(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('supply-groups/:id/items')
  @HasPermission('planning.edit')
  addItemsToSupplyGroup(
    @Param('id') id: string,
    @Body() body: { items: SupplyGroupItemBody[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.addItemsToSupplyGroup(
      id,
      body.items,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('supply-groups/convert')
  @HasPermission('planning.edit')
  convertForecastsToGroup(
    @Body() body: ConvertForecastsBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.convertForecastsToGroup({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post('forecasts')
  @HasPermission('planning.edit')
  createForecast(
    @Body() body: CreateForecastBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.createForecast({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch('forecasts/:id')
  @HasPermission('planning.edit')
  updateForecast(
    @Param('id') id: string,
    @Body() body: UpdateForecastBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateForecast(
      id,
      req.user.instanceId,
      body,
      req.user.id,
    );
  }

  @Delete('forecasts/:id')
  @HasPermission('planning.edit')
  deleteForecast(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteForecast(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Get('milestones')
  listMilestones(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listMilestones(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('milestones')
  @HasPermission('planning.edit')
  createMilestone(
    @Body() body: CreateMilestoneBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.createMilestone({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post('replace')
  @HasPermission('planning.edit')
  replace(
    @Body()
    body: {
      projectId: string;
      tasks?: CreateTaskBody[];
      forecasts?: CreateForecastBody[];
      milestones?: CreateMilestoneBody[];
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ replaced: number }> {
    return this.planningService.replaceAll(
      body.projectId,
      body.tasks ?? [],
      body.forecasts ?? [],
      body.milestones ?? [],
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch('milestones/:id')
  @HasPermission('planning.edit')
  updateMilestone(
    @Param('id') id: string,
    @Body() body: UpdateMilestoneBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateMilestone(
      id,
      req.user.instanceId,
      body,
      req.user.id,
    );
  }

  @Delete('milestones/:id')
  @HasPermission('planning.edit')
  deleteMilestone(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteMilestone(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }
}
