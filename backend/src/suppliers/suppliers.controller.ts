import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
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
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  instanceId?: string;
}

type UpdateSupplierBody = Partial<CreateSupplierBody>;

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve effective instanceId. When body.instanceId is provided and differs
   * from the user's home instance, verify cross-instance membership.
   */
  private async resolveInstanceId(
    bodyInstanceId: string | undefined,
    req: AuthenticatedRequest,
  ): Promise<string> {
    const effectiveId = bodyInstanceId || req.user.instanceId;
    if (effectiveId !== req.user.instanceId) {
      const count = await this.prisma.projectMember.count({
        where: { userId: req.user.id, project: { instanceId: effectiveId } },
      });
      if (count === 0) {
        throw new ForbiddenException('Sem acesso a esta instância');
      }
    }
    return effectiveId;
  }

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.suppliersService.findAll(req.user.instanceId);
  }

  @Get('by-instance/:instanceId')
  findByInstance(
    @Param('instanceId') instanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.suppliersService.findAllByInstance(
      instanceId,
      req.user.id,
      req.user.instanceId,
    );
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.suppliersService.findById(id, req.user.instanceId);
  }

  @Post()
  @HasPermission('suppliers.edit')
  async create(@Body() body: CreateSupplierBody, @Req() req: AuthenticatedRequest) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.suppliersService.create({
      ...body,
      instanceId,
      userId: req.user.id,
    });
  }

  @Patch('batch-reorder')
  @HasPermission('suppliers.edit')
  async batchReorder(
    @Body() body: { items: Array<{ id: string; order: number }>; instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.suppliersService.batchReorder(
      body.items,
      instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('suppliers.edit')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateSupplierBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.suppliersService.update({
      ...body,
      id,
      instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('suppliers.edit')
  async remove(
    @Param('id') id: string,
    @Body() body: { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body?.instanceId, req);
    return this.suppliersService.remove(id, instanceId, req.user.id);
  }
}
