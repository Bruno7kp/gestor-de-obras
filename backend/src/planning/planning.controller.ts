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
  description: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  order?: number;
  supplierId?: string | null;
  paymentProof?: string | null;
}

type UpdateForecastBody = Partial<CreateForecastBody>;

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
    return this.planningService.listTasks(projectId, req.user.instanceId);
  }

  @Post('tasks')
  @HasPermission('planning.edit')
  createTask(@Body() body: CreateTaskBody, @Req() req: AuthenticatedRequest) {
    return this.planningService.createTask({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('tasks/:id')
  @HasPermission('planning.edit')
  updateTask(
    @Param('id') id: string,
    @Body() body: UpdateTaskBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateTask(id, req.user.instanceId, body);
  }

  @Delete('tasks/:id')
  @HasPermission('planning.edit')
  deleteTask(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteTask(id, req.user.instanceId);
  }

  @Get('forecasts')
  listForecasts(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listForecasts(projectId, req.user.instanceId);
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
    });
  }

  @Patch('forecasts/:id')
  @HasPermission('planning.edit')
  updateForecast(
    @Param('id') id: string,
    @Body() body: UpdateForecastBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateForecast(id, req.user.instanceId, body);
  }

  @Delete('forecasts/:id')
  @HasPermission('planning.edit')
  deleteForecast(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteForecast(id, req.user.instanceId);
  }

  @Get('milestones')
  listMilestones(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.listMilestones(projectId, req.user.instanceId);
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
    );
  }

  @Patch('milestones/:id')
  @HasPermission('planning.edit')
  updateMilestone(
    @Param('id') id: string,
    @Body() body: UpdateMilestoneBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.planningService.updateMilestone(id, req.user.instanceId, body);
  }

  @Delete('milestones/:id')
  @HasPermission('planning.edit')
  deleteMilestone(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.planningService.deleteMilestone(id, req.user.instanceId);
  }
}
