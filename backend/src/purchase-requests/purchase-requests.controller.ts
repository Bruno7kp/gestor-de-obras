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
import { PurchaseRequestsService } from './purchase-requests.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveInstanceAccess } from '../common/instance-access.util';

interface CreatePurchaseRequestBody {
  globalStockItemId: string;
  quantity: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  notes?: string;
  stockRequestId?: string;
}

interface CompleteBody {
  invoiceNumber?: string;
  unitPrice: number;
  supplierId?: string;
}

@Controller('purchase-requests')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class PurchaseRequestsController {
  constructor(
    private readonly service: PurchaseRequestsService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get()
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  async findAll(
    @Query('status') status: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.findAll(instanceId, status || undefined);
  }

  @Post()
  @HasPermission('global_stock_warehouse.edit')
  async create(
    @Body() body: CreatePurchaseRequestBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.service.create({
      instanceId,
      userId: req.user.id,
      globalStockItemId: body.globalStockItemId,
      quantity: body.quantity,
      priority: body.priority,
      notes: body.notes,
      stockRequestId: body.stockRequestId,
    });
  }

  @Patch(':id/order')
  @HasPermission('global_stock_financial.edit')
  async markOrdered(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.markOrdered({
      id,
      instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id/complete')
  @HasPermission('global_stock_financial.edit')
  async complete(
    @Param('id') id: string,
    @Body() body: CompleteBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.service.complete({
      id,
      instanceId,
      userId: req.user.id,
      invoiceNumber: body.invoiceNumber,
      unitPrice: body.unitPrice,
      supplierId: body.supplierId,
    });
  }

  @Patch(':id/cancel')
  @HasPermission('global_stock_financial.edit')
  async cancel(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.cancel({
      id,
      instanceId,
      userId: req.user.id,
    });
  }
}
