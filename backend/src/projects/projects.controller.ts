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
import { ProjectsService } from './projects.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateProjectBody {
  name: string;
  companyName: string;
  companyCnpj?: string;
  location?: string;
  referenceDate?: string;
  bdi?: number;
  groupId?: string | null;
}

interface CloseMeasurementBody {
  measurementNumber: number;
  nextMeasurementNumber: number;
  date: string;
  referenceDate: string;
  itemsSnapshot: unknown;
  totals: unknown;
  roundingAdjustment?: number;
  workItems?: Array<{
    id: string;
    previousQuantity?: number;
    previousTotal?: number;
    currentQuantity?: number;
    currentTotal?: number;
    currentPercentage?: number;
    accumulatedQuantity?: number;
    accumulatedTotal?: number;
    accumulatedPercentage?: number;
    balanceQuantity?: number;
    balanceTotal?: number;
  }>;
  blueprintItems?: Record<string, unknown>[];
}

interface UpdateProjectBody {
  name?: string;
  description?: string | null;
  responsavel?: string | null;
  companyName?: string;
  companyCnpj?: string;
  location?: string;
  referenceDate?: string;
  measurementNumber?: number;
  logo?: string | null;
  bdi?: number;
  groupId?: string | null;
  contractTotalOverride?: number | null;
  currentTotalOverride?: number | null;
  roundingAdjustment?: number | null;
  order?: number;
  theme?: {
    fontFamily?: string;
    primary?: string;
    accent?: string;
    accentText?: string;
    border?: string;
    currencySymbol?: string;
    header?: { bg?: string; text?: string };
    category?: { bg?: string; text?: string };
    footer?: { bg?: string; text?: string };
    kpiHighlight?: { bg?: string; text?: string };
  };
  config?: {
    strict?: boolean;
    printCards?: boolean;
    printSubtotals?: boolean;
    showSignatures?: boolean;
  };
}

interface ReopenMeasurementBody {
  measurementNumber: number;
}

interface UpdateProjectLifecycleBody {
  action: 'archive' | 'reactivate';
  projectNameConfirmation: string;
}

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('groupId') groupId?: string,
  ) {
    return this.projectsService.findAll(
      req.user.instanceId,
      req.user.id,
      req.user.permissions || [],
      groupId,
    );
  }

  @Get('external')
  listExternalProjects(@Req() req: AuthenticatedRequest) {
    return this.projectsService.getExternalProjects(
      req.user.id,
      req.user.instanceId,
    );
  }

  @Get('external/:id')
  findExternalById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.findExternalById(id, req.user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.findById(
      id,
      req.user.instanceId,
      req.user.id,
      req.user.permissions || [],
    );
  }

  @Post()
  @HasPermission('projects_general.edit')
  create(@Body() body: CreateProjectBody, @Req() req: AuthenticatedRequest) {
    return this.projectsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  @HasPermission(
    'projects_general.edit',
    'projects_specific.view',
    'projects_specific.edit',
  )
  update(
    @Param('id') id: string,
    @Body() body: UpdateProjectBody,
    @Req() req: AuthenticatedRequest,
  ) {
    console.log('[PATCH projects] roundingAdjustment:', body.roundingAdjustment);
    return this.projectsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      permissions: req.user.permissions || [],
    });
  }

  @Post(':id/close-measurement')
  closeMeasurement(
    @Param('id') id: string,
    @Body() body: CloseMeasurementBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.closeMeasurement({
      projectId: id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      permissions: req.user.permissions || [],
      measurementNumber: body.measurementNumber,
      nextMeasurementNumber: body.nextMeasurementNumber,
      date: body.date,
      referenceDate: body.referenceDate,
      itemsSnapshot: body.itemsSnapshot,
      totals: body.totals,
      roundingAdjustment: body.roundingAdjustment,
      workItems: body.workItems,
      blueprintItems: body.blueprintItems,
    });
  }

  @Post(':id/reopen-measurement')
  reopenMeasurement(
    @Param('id') id: string,
    @Body() body: ReopenMeasurementBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.reopenMeasurement({
      projectId: id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      permissions: req.user.permissions || [],
      measurementNumber: body.measurementNumber,
    });
  }

  @Patch(':id/lifecycle')
  updateLifecycle(
    @Param('id') id: string,
    @Body() body: UpdateProjectLifecycleBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.updateLifecycle({
      id,
      action: body.action,
      projectNameConfirmation: body.projectNameConfirmation,
      instanceId: req.user.instanceId,
      userId: req.user.id,
      permissions: req.user.permissions || [],
    });
  }

  @Delete(':id')
  @HasPermission('projects_general.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.remove(
      id,
      req.user.instanceId,
      req.user.id,
      req.user.permissions || [],
    );
  }
}
