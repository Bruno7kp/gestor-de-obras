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
import { ProjectGroupsService } from './project-groups.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateProjectGroupBody {
  name: string;
  parentId?: string | null;
  order?: number;
}

interface UpdateProjectGroupBody {
  name?: string;
  parentId?: string | null;
  order?: number;
}

@Controller('project-groups')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ProjectGroupsController {
  constructor(private readonly projectGroupsService: ProjectGroupsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.projectGroupsService.findAll(req.user.instanceId);
  }

  @Post()
  create(
    @Body() body: CreateProjectGroupBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectGroupsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProjectGroupBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectGroupsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectGroupsService.remove(id, req.user.instanceId);
  }
}
