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

interface CreatePurchaseRequestBody {
  globalStockItemId: string;
  quantity: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  notes?: string;
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
  constructor(private readonly service: PurchaseRequestsService) {}

  @Get()
  @HasPermission(
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
    'global_stock_financial.view',
    'global_stock_financial.edit',
  )
  findAll(
    @Query('status') status: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.findAll(
      req.user.instanceId,
      status || undefined,
    );
  }

  @Post()
  @HasPermission('global_stock_warehouse.edit')
  create(
    @Body() body: CreatePurchaseRequestBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create({
      instanceId: req.user.instanceId,
      userId: req.user.id,
      globalStockItemId: body.globalStockItemId,
      quantity: body.quantity,
      priority: body.priority,
      notes: body.notes,
    });
  }

  @Patch(':id/order')
  @HasPermission('global_stock_financial.edit')
  markOrdered(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.markOrdered({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id/complete')
  @HasPermission('global_stock_financial.edit')
  complete(
    @Param('id') id: string,
    @Body() body: CompleteBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.complete({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      invoiceNumber: body.invoiceNumber,
      unitPrice: body.unitPrice,
      supplierId: body.supplierId,
    });
  }

  @Patch(':id/cancel')
  @HasPermission('global_stock_financial.edit')
  cancel(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel({
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }
}
