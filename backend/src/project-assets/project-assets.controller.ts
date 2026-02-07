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
import { ProjectAssetsService } from './project-assets.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateAssetBody {
  id?: string;
  projectId: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadDate: string;
  data: string;
}

type UpdateAssetBody = Partial<CreateAssetBody>;

@Controller('project-assets')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class ProjectAssetsController {
  constructor(private readonly projectAssetsService: ProjectAssetsService) {}

  @Get()
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectAssetsService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('documents.edit')
  create(@Body() body: CreateAssetBody, @Req() req: AuthenticatedRequest) {
    return this.projectAssetsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id')
  @HasPermission('documents.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateAssetBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.projectAssetsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('documents.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.projectAssetsService.remove(
      id,
      req.user.instanceId,
      req.user.id,
    );
  }
}
