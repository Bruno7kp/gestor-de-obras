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
import { ProjectExpensesService } from './project-expenses.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { ExpenseStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateExpenseBody {
  id?: string;
  projectId: string;
  parentId?: string | null;
  type: string;
  itemType: string;
  wbs?: string;
  order?: number;
  date: string;
  description: string;
  entityName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isPaid?: boolean;
  status?: ExpenseStatus;
  paymentDate?: string;
  paymentProof?: string;
  invoiceDoc?: string;
  deliveryDate?: string;
  discountValue?: number;
  discountPercentage?: number;
  issValue?: number;
  issPercentage?: number;
  linkedWorkItemId?: string;
}

type UpdateExpenseBody = Partial<CreateExpenseBody>;

@Controller('project-expenses')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ProjectExpensesController {
  constructor(
    private readonly projectExpensesService: ProjectExpensesService,
  ) {}

  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectExpensesService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('financial_flow.edit')
  create(@Body() body: CreateExpenseBody, @Req() req: AuthenticatedRequest) {
    return this.projectExpensesService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post('batch')
  @HasPermission('financial_flow.edit')
  batch(
    @Body()
    body: {
      projectId: string;
      expenses: CreateExpenseBody[];
      replaceTypes?: string[];
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ created: number }> {
    return this.projectExpensesService.batchInsert(
      body.projectId,
      body.expenses,
      body.replaceTypes ?? null,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('financial_flow.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExpenseBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectExpensesService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('financial_flow.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectExpensesService.remove(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }
}
