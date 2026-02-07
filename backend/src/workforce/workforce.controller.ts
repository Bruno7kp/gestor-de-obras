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
import { WorkforceService } from './workforce.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateWorkforceBody {
  projectId: string;
  nome: string;
  cpf_cnpj: string;
  empresa_vinculada: string;
  foto?: string | null;
  cargo: string;
  documentos?: Array<{
    nome: string;
    dataVencimento: string;
    arquivoUrl?: string | null;
    status: string;
  }>;
  linkedWorkItemIds?: string[];
}

type UpdateWorkforceBody = Partial<CreateWorkforceBody>;

interface AddDocumentBody {
  nome: string;
  dataVencimento: string;
  arquivoUrl?: string | null;
  status: string;
}

interface AddResponsibilityBody {
  workItemId: string;
}

@Controller('workforce-members')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class WorkforceController {
  constructor(private readonly workforceService: WorkforceService) {}

  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  create(@Body() body: CreateWorkforceBody, @Req() req: AuthenticatedRequest) {
    return this.workforceService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateWorkforceBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.workforceService.remove(id, req.user.instanceId, req.user.id);
  }

  @Post(':id/documents')
  addDocument(
    @Param('id') id: string,
    @Body() body: AddDocumentBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.addDocument(
      id,
      req.user.instanceId,
      body,
      req.user.id,
    );
  }

  @Delete(':id/documents/:documentId')
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.removeDocument(
      id,
      documentId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post(':id/responsibilities')
  addResponsibility(
    @Param('id') id: string,
    @Body() body: AddResponsibilityBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.addResponsibility(
      id,
      body.workItemId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Delete(':id/responsibilities/:workItemId')
  removeResponsibility(
    @Param('id') id: string,
    @Param('workItemId') workItemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workforceService.removeResponsibility(
      id,
      workItemId,
      req.user.instanceId,
      req.user.id,
    );
  }
}
