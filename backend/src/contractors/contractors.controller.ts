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
import { ContractorsService } from './contractors.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateContractorBody {
  name: string;
  cnpj?: string;
  type?: string;
  city?: string;
  specialty?: string;
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
}

type UpdateContractorBody = Partial<CreateContractorBody>;

@Controller('contractors')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.contractorsService.findAll(req.user.instanceId);
  }

  @Get('by-instance/:instanceId')
  findByInstance(
    @Param('instanceId') instanceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.findAllByInstance(
      instanceId,
      req.user.id,
    );
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contractorsService.findById(id, req.user.instanceId);
  }

  @Post()
  @HasPermission('workforce.edit')
  create(
    @Body() body: CreateContractorBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  /**
   * Find or create a contractor by name.
   * Used by the workforce autocomplete to auto-create contractors.
   */
  @Post('ensure')
  @HasPermission('workforce.edit')
  ensure(
    @Body() body: { name: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.findOrCreate(
      body.name,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch('batch-reorder')
  @HasPermission('workforce.edit')
  batchReorder(
    @Body() body: { items: Array<{ id: string; order: number }> },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.batchReorder(
      body.items,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch(':id')
  @HasPermission('workforce.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateContractorBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.contractorsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('workforce.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.contractorsService.remove(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }
}
