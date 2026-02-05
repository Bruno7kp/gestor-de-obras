import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectAssetsService } from './project-assets.service';
import { Roles } from '../auth/roles.decorator';

interface CreateAssetBody {
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
  findAll(@Query('projectId') projectId: string, @Req() req: any) {
    return this.projectAssetsService.findAll(projectId, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateAssetBody, @Req() req: any) {
    return this.projectAssetsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAssetBody, @Req() req: any) {
    return this.projectAssetsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.projectAssetsService.remove(id, req.user.instanceId);
  }
}
