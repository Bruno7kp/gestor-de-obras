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
import { PrismaService } from '../prisma/prisma.service';
import { resolveInstanceAccess } from '../common/instance-access.util';

interface CreateStockRequestBody {
  projectId: string;
  globalStockItemId: string;
  quantity: number;
  notes?: string;
}

interface RejectBody {
  rejectionReason?: string;
}

interface DeliverBody {
  quantity: number;
  notes?: string;
  createPurchaseForRemaining?: boolean;
}

@Controller('stock-requests')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class StockRequestsController {
  constructor(
    private readonly service: StockRequestsService,
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
    'stock.view',
    'stock.edit',
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
  )
  async findAll(
    @Query('projectId') projectId: string,
    @Query('status') status: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.findAll({
      instanceId,
      userId: req.user.id,
      projectId: projectId || undefined,
      status: status || undefined,
    });
  }

  @Post()
  @HasPermission('stock.edit')
  async create(
    @Body() body: CreateStockRequestBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.service.create({
      instanceId,
      userId: req.user.id,
      projectId: body.projectId,
      globalStockItemId: body.globalStockItemId,
      quantity: body.quantity,
      notes: body.notes,
    });
  }

  @Patch(':id/approve')
  @HasPermission('global_stock_warehouse.edit')
  async approve(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.approve({
      id,
      instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id/reject')
  @HasPermission('global_stock_warehouse.edit')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.service.reject({
      id,
      instanceId,
      userId: req.user.id,
      rejectionReason: body.rejectionReason,
    });
  }

  @Patch(':id/deliver')
  @HasPermission('global_stock_warehouse.edit')
  async deliver(
    @Param('id') id: string,
    @Body() body: DeliverBody & { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, body.instanceId);
    return this.service.deliver({
      id,
      instanceId,
      userId: req.user.id,
      quantity: body.quantity,
      notes: body.notes,
      createPurchaseForRemaining: body.createPurchaseForRemaining,
    });
  }

  @Get(':id/deliveries')
  @HasPermission(
    'stock.view',
    'stock.edit',
    'global_stock_warehouse.view',
    'global_stock_warehouse.edit',
  )
  async findDeliveries(
    @Param('id') id: string,
    @Query('instanceId') targetInstanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstance(req, targetInstanceId);
    return this.service.findDeliveries(id, instanceId);
  }
}
