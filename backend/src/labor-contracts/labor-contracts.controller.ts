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
import { LaborContractsService } from './labor-contracts.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface LaborPaymentBody {
  id?: string;
  data: string;
  valor: number;
  descricao: string;
  comprovante?: string;
  createdById?: string | null;
}

interface CreateLaborContractBody {
  projectId: string;
  tipo: string;
  descricao: string;
  associadoId: string;
  valorTotal: number;
  dataInicio: string;
  dataFim?: string;
  linkedWorkItemId?: string;
  linkedWorkItemIds?: string[];
  observacoes?: string;
  ordem?: number;
  pagamentos?: LaborPaymentBody[];
}

type UpdateLaborContractBody = Partial<CreateLaborContractBody>;

@Controller('labor-contracts')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class LaborContractsController {
  constructor(private readonly laborContractsService: LaborContractsService) {}

  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.laborContractsService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  create(
    @Body() body: CreateLaborContractBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.laborContractsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateLaborContractBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.laborContractsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post(':id/payments')
  upsertPayment(
    @Param('id') id: string,
    @Body() body: LaborPaymentBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.laborContractsService.upsertPayment(
      id,
      body,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.laborContractsService.remove(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }
}
