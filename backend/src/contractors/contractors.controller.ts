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
import { ContractorsService } from './contractors.service';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateContractorBody {
  name: string;
  cnpj?: string;
  type?: string;
  city?: string;
  specialty?: string;
  cargo?: string;
  status?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  notes?: string;
  order?: number;
  instanceId?: string;
}

type UpdateContractorBody = Partial<CreateContractorBody>;

@Controller('contractors')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ContractorsController {
  constructor(
    private readonly contractorsService: ContractorsService,
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
    return this.contractorsService.findAll(req.user.instanceId);
  }

  @Get('cargos')
  listCargos(@Req() req: AuthenticatedRequest) {
    return this.contractorsService.listUniqueCargos(req.user.instanceId);
  }

  @Get('by-instance/:instanceId')
  findByInstance(
    @Param('instanceId') instanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.findAllByInstance(
      instanceId,
      req.user.id,
      req.user.instanceId,
    );
  }

  @Get('by-instance/:instanceId/cargos')
  async listCargosByInstance(
    @Param('instanceId') instanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const hasAccess = await this.prisma.projectMember.count({
      where: { userId: req.user.id, project: { instanceId } },
    });
    if (instanceId !== req.user.instanceId && hasAccess === 0) {
      throw new ForbiddenException('Sem acesso a esta instância');
    }
    return this.contractorsService.listUniqueCargos(instanceId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contractorsService.findById(id, req.user.instanceId);
  }

  @Post()
  @HasPermission('workforce.edit')
  async create(
    @Body() body: CreateContractorBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.contractorsService.create({
      ...body,
      instanceId,
      userId: req.user.id,
    });
  }

  /**
   * Find or create a contractor by name.
   * Used by the workforce autocomplete to auto-create contractors.
   */
  @Post('ensure')
  @HasPermission('workforce.edit')
  ensure(@Body() body: { name: string }, @Req() req: AuthenticatedRequest) {
    return this.contractorsService.findOrCreate(
      body.name,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch('batch-reorder')
  @HasPermission('workforce.edit')
  async batchReorder(
    @Body()
    body: { items: Array<{ id: string; order: number }>; instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.contractorsService.batchReorder(
      body.items,
      instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('workforce.edit')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateContractorBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body.instanceId, req);
    return this.contractorsService.update({
      ...body,
      id,
      instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('workforce.edit')
  async remove(
    @Param('id') id: string,
    @Body() body: { instanceId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const instanceId = await this.resolveInstanceId(body?.instanceId, req);
    return this.contractorsService.remove(id, instanceId, req.user.id);
  }
}
