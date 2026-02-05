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
import type { ExpenseStatus } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateExpenseBody {
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.projectExpensesService.findAll(projectId, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateExpenseBody, @Req() req: AuthenticatedRequest) {
    return this.projectExpensesService.create({
      ...body,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExpenseBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectExpensesService.update({
      ...body,
      id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    return this.projectExpensesService.remove(id, req.user.instanceId);
  }
}
