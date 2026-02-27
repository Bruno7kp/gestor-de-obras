import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StockRequestsService } from './stock-requests.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateStockRequestBody {
  projectId: string;
  globalStockItemId: string;
  quantity: number;
  notes?: string;
}

interface RejectBody {
  rejectionReason?: string;
}

@Controller('stock-requests')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class StockRequestsController {
  constructor(private readonly service: StockRequestsService) {}

  @Get()
  @HasPermission(
    'stock.view',
    'stock.edit',
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
  )
  findAll(
    @Query('projectId') projectId: string,
    @Query('status') status: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findAll({
      instanceId: req.user.instanceId,
      userId: req.user.id,
      projectId: projectId || undefined,
      status: status || undefined,
    });
  }

  @Post()
  @HasPermission('stock.edit')
  create(
    @Body() body: CreateStockRequestBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create({
      instanceId: req.user.instanceId,
      userId: req.user.id,
      projectId: body.projectId,
      globalStockItemId: body.globalStockItemId,
      quantity: body.quantity,
      notes: body.notes,
    });
  }

  @Patch(':id/approve')
  @HasPermission('global_stock_warehouse.edit')
  approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.approve({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id/reject')
  @HasPermission('global_stock_warehouse.edit')
  reject(
    @Param('id') id: string,
    @Body() body: RejectBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reject({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      rejectionReason: body.rejectionReason,
    });
  }
}
