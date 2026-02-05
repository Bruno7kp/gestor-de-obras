import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlanningService } from './planning.service';
import { Roles } from '../auth/roles.decorator';

interface CreateTaskBody {
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
  listTasks(@Query('projectId') projectId: string, @Req() req: any) {
    return this.planningService.listTasks(projectId, req.user.instanceId);
  }

  @Post('tasks')
  createTask(@Body() body: CreateTaskBody, @Req() req: any) {
    return this.planningService.createTask({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: UpdateTaskBody, @Req() req: any) {
    return this.planningService.updateTask(id, req.user.instanceId, body);
  }

  @Delete('tasks/:id')
  deleteTask(@Param('id') id: string, @Req() req: any) {
    return this.planningService.deleteTask(id, req.user.instanceId);
  }

  @Get('forecasts')
  listForecasts(@Query('projectId') projectId: string, @Req() req: any) {
    return this.planningService.listForecasts(projectId, req.user.instanceId);
  }

  @Post('forecasts')
  createForecast(@Body() body: CreateForecastBody, @Req() req: any) {
    return this.planningService.createForecast({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('forecasts/:id')
  updateForecast(@Param('id') id: string, @Body() body: UpdateForecastBody, @Req() req: any) {
    return this.planningService.updateForecast(id, req.user.instanceId, body);
  }

  @Delete('forecasts/:id')
  deleteForecast(@Param('id') id: string, @Req() req: any) {
    return this.planningService.deleteForecast(id, req.user.instanceId);
  }

  @Get('milestones')
  listMilestones(@Query('projectId') projectId: string, @Req() req: any) {
    return this.planningService.listMilestones(projectId, req.user.instanceId);
  }

  @Post('milestones')
  createMilestone(@Body() body: CreateMilestoneBody, @Req() req: any) {
    return this.planningService.createMilestone({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('milestones/:id')
  updateMilestone(@Param('id') id: string, @Body() body: UpdateMilestoneBody, @Req() req: any) {
    return this.planningService.updateMilestone(id, req.user.instanceId, body);
  }

  @Delete('milestones/:id')
  deleteMilestone(@Param('id') id: string, @Req() req: any) {
    return this.planningService.deleteMilestone(id, req.user.instanceId);
  }
}
