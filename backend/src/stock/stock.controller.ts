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
import { StockService } from './stock.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import type { StockMovementType } from '@prisma/client';

interface CreateStockItemBody {
  projectId: string;
  name: string;
  unit?: string;
  minQuantity?: number;
}

interface UpdateStockItemBody {
  name?: string;
  unit?: string;
  minQuantity?: number;
}

interface AddMovementBody {
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  responsible?: string;
  notes?: string;
  date?: string;
}

interface UpdateMovementBody {
  quantity?: number;
  responsible?: string;
  notes?: string;
  date?: string;
}

interface ReorderBody {
  projectId: string;
  items: Array<{ id: string; order: number }>;
}

@Controller('stock')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @HasPermission('stock.view', 'stock.edit')
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('stock.edit')
  create(@Body() body: CreateStockItemBody, @Req() req: AuthenticatedRequest) {
    return this.stockService.create({
      projectId: body.projectId,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
    });
  }

  @Patch('reorder')
  @HasPermission('stock.edit')
  reorder(@Body() body: ReorderBody, @Req() req: AuthenticatedRequest) {
    return this.stockService.reorder({
      instanceId: req.user.instanceId,
      userId: req.user.id,
      projectId: body.projectId,
      items: body.items,
    });
  }

  @Patch('movements/:movId')
  @HasPermission('stock.edit')
  updateMovement(
    @Param('movId') movId: string,
    @Body() body: UpdateMovementBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.updateMovement({
      movementId: movId,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      quantity: body.quantity,
      responsible: body.responsible,
      notes: body.notes,
      date: body.date,
    });
  }

  @Delete('movements/:movId')
  @HasPermission('stock.edit')
  deleteMovement(
    @Param('movId') movId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.deleteMovement(
      movId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('stock.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateStockItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.update({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
    });
  }

  @Delete(':id')
  @HasPermission('stock.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.stockService.remove(id, req.user.instanceId, req.user.id);
  }

  @Post(':id/movements')
  @HasPermission('stock.edit')
  addMovement(
    @Param('id') id: string,
    @Body() body: AddMovementBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.addMovement({
      stockItemId: id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      type: body.type as StockMovementType,
      quantity: body.quantity,
      responsible: body.responsible,
      notes: body.notes,
      date: body.date,
    });
  }

  @Get(':id/movements')
  @HasPermission('stock.view', 'stock.edit')
  findMovements(
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.stockService.findMovements(
      id,
      req.user.instanceId,
      req.user.id,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 10,
    );
  }
}
