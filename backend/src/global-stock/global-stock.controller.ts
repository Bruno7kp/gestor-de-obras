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
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveInstanceAccess,
  getAccessibleStockInstances,
} from '../common/instance-access.util';

interface CreateGlobalStockItemBody {
  name: string;
  unit?: string;
  minQuantity?: number | null;
  initialPrice?: number;
  supplierId?: string;
}

interface UpdateGlobalStockItemBody {
  name?: string;
  unit?: string;
  minQuantity?: number | null;
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
  constructor(
    private readonly globalStockService: GlobalStockService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the effective instanceId, supporting cross-instance access.
   */
  private resolveInstance(
    req: AuthenticatedRequest,
    targetInstanceId?: string,
  ) {
    return resolveInstanceAccess(
      this.prisma,
      req.user.id,
      req.user.instanceId,
      targetInstanceId || undefined,
    );
  }

  @Get('accessible-instances')
  getAccessibleInstances(@Req() req: AuthenticatedRequest) {
    return getAccessibleStockInstances(
      this.prisma,
      req.user.id,
      req.user.instanceId,
    );
  }

  @Get()
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
    'stock.view',
    'stock.edit',
  )
  async findAll(
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.findAllWithAccess({
      userId: req.user.id,
      homeInstanceId: req.user.instanceId,
      resolvedInstanceId: instanceId,
    });
  }

  @Post()
  @HasPermission('global_stock_warehouse.edit', 'global_stock_financial.edit')
  async create(
    @Body() body: CreateGlobalStockItemBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.globalStockService.createWithAccess({
      userId: req.user.id,
      homeInstanceId: req.user.instanceId,
      resolvedInstanceId: instanceId,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
      initialPrice: body.initialPrice,
      supplierId: body.supplierId,
    });
  }

  @Patch('reorder')
  @HasPermission('global_stock_warehouse.edit')
  async reorder(
    @Body() body: ReorderBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.globalStockService.reorder(instanceId, body.items);
  }

  @Patch(':id')
  @HasPermission('global_stock_warehouse.edit', 'global_stock_financial.edit')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateGlobalStockItemBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.globalStockService.update({
      id,
      instanceId,
      userId: req.user.id,
      name: body.name,
      unit: body.unit,
      minQuantity: body.minQuantity,
      supplierId: body.supplierId,
    });
  }

  @Delete(':id')
  @HasPermission('global_stock_warehouse.edit', 'global_stock_financial.edit')
  async remove(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.remove(id, instanceId, req.user.id);
  }

  @Get(':id/usage')
  @HasPermission('global_stock_warehouse.edit')
  async getUsageSummary(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.getUsageSummary(id, instanceId);
  }

  @Post(':id/movements')
  @HasPermission('global_stock_warehouse.edit')
  async addMovement(
    @Param('id') id: string,
    @Body() body: AddGlobalMovementBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.globalStockService.addMovement({
      globalStockItemId: id,
      instanceId,
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

  @Get('project-consumption/:projectId')
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
    'stock.view',
    'stock.edit',
  )
  async getProjectConsumption(
    @Param('projectId') projectId: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.getProjectConsumptionSummary(
      projectId,
      instanceId,
    );
  }

  @Get('movements')
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  async findAllMovements(
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('projectId') projectId: string,
    @Query('search') search: string,
    @Query('globalStockItemId') globalStockItemId: string,
    @Query('dateStart') dateStart: string,
    @Query('dateEnd') dateEnd: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.findAllMovements({
      instanceId,
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 50,
      projectId: projectId || undefined,
      search: search || undefined,
      globalStockItemId: globalStockItemId || undefined,
      dateStart: dateStart || undefined,
      dateEnd: dateEnd || undefined,
    });
  }

  @Get(':id/movements')
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  async findItemMovements(
    @Param('id') id: string,
    @Query('skip') skip: string,
    @Query('take') take: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.globalStockService.findItemMovements({
      globalStockItemId: id,
      instanceId,
      skip: skip ? parseInt(skip, 10) : 0,
      take: take ? parseInt(take, 10) : 20,
    });
  }
}
