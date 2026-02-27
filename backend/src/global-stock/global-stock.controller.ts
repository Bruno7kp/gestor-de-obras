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
import { GlobalStockService } from './global-stock.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateGlobalStockItemBody {
  name: string;
  unit?: string;
  minQuantity?: number;
  supplierId?: string;
}

interface UpdateGlobalStockItemBody {
  name?: string;
  unit?: string;
  minQuantity?: number;
  supplierId?: string | null;
}

interface AddGlobalMovementBody {
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  unitPrice?: number;
  responsible?: string;
  originDestination?: string;
  projectId?: string;
  invoiceNumber?: string;
  supplierId?: string;
  notes?: string;
  date?: string;
}

interface ReorderBody {
  items: Array<{ id: string; order: number }>;
}

@Controller('global-stock')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class GlobalStockController {
  constructor(private readonly globalStockService: GlobalStockService) {}

  @Get()
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
    'stock.view',
    'stock.edit',
  )
  findAll(@Req() req: AuthenticatedRequest) {
    return this.globalStockService.findAll(req.user.instanceId);
  }

  @Post()
  @HasPermission('global_stock_warehouse.edit')
  create(
    @Body() body: CreateGlobalStockItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.globalStockService.create({
      instanceId: req.user.instanceId,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
      supplierId: body.supplierId,
    });
  }

  @Patch('reorder')
  @HasPermission('global_stock_warehouse.edit')
  reorder(@Body() body: ReorderBody, @Req() req: AuthenticatedRequest) {
    return this.globalStockService.reorder(req.user.instanceId, body.items);
  }

  @Patch(':id')
  @HasPermission('global_stock_warehouse.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateGlobalStockItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.globalStockService.update({
      id,
      instanceId: req.user.instanceId,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
      supplierId: body.supplierId,
    });
  }

  @Delete(':id')
  @HasPermission('global_stock_warehouse.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.globalStockService.remove(id, req.user.instanceId);
  }

  @Post(':id/movements')
  @HasPermission('global_stock_warehouse.edit')
  addMovement(
    @Param('id') id: string,
    @Body() body: AddGlobalMovementBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.globalStockService.addMovement({
      globalStockItemId: id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      type: body.type,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      responsible: body.responsible,
      originDestination: body.originDestination,
      projectId: body.projectId,
      invoiceNumber: body.invoiceNumber,
      supplierId: body.supplierId,
      notes: body.notes,
      date: body.date,
    });
  }

  @Get('movements')
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  findAllMovements(
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.globalStockService.findAllMovements({
      instanceId: req.user.instanceId,
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 50,
      projectId: projectId || undefined,
    });
  }

  @Get(':id/movements')
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  findItemMovements(
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.globalStockService.findItemMovements({
      globalStockItemId: id,
      instanceId: req.user.instanceId,
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 20,
    });
  }
}
