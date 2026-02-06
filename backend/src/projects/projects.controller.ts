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

interface UpdateProjectBody {
  name?: string;
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
    return this.projectsService.findAll(req.user.instanceId, groupId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.findById(id, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateProjectBody, @Req() req: AuthenticatedRequest) {
    return this.projectsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProjectBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectsService.remove(id, req.user.instanceId);
  }
}
