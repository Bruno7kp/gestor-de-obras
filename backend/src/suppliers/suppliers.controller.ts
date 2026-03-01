import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateSupplierBody {
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  rating: number;
  notes?: string;
  order?: number;
}

type UpdateSupplierBody = Partial<CreateSupplierBody>;

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.suppliersService.findAll(req.user.instanceId);
  }

  @Get('by-instance/:instanceId')
  findByInstance(
    @Param('instanceId') instanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.suppliersService.findAllByInstance(instanceId, req.user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.findById(id, req.user.instanceId);
  }

  @Post()
  @HasPermission('suppliers.edit')
  create(@Body() body: CreateSupplierBody, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch('batch-reorder')
  @HasPermission('suppliers.edit')
  batchReorder(
    @Body() body: { items: Array<{ id: string; order: number }> },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.suppliersService.batchReorder(
      body.items,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('suppliers.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateSupplierBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.suppliersService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('suppliers.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.remove(id, req.user.instanceId, req.user.id);
  }
}
