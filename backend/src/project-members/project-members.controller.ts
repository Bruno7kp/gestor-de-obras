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
import { ProjectMembersService } from './project-members.service';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface AddMemberBody {
  email: string;
  roleId?: string;
}

interface UpdateMemberBody {
  roleId: string;
}

@Controller('projects/:projectId/members')
@UseGuards(AuthGuard('jwt'))
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  @HasPermission('projects_general.view', 'projects_specific.view')
  listMembers(
    @Param('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.membersService.listMembers(projectId, req.user.instanceId);
  }

  @Post()
  @HasPermission('projects_general.edit')
  addMember(
    @Param('projectId') projectId: string,
    @Body() body: AddMemberBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.membersService.addMemberByEmail({
      projectId,
      email: body.email,
      roleId: body.roleId,
      addedById: req.user.id,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':userId')
  @HasPermission('projects_general.edit')
  updateMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateMemberBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.membersService.updateMember({
      projectId,
      userId,
      roleId: body.roleId,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':userId')
  @HasPermission('projects_general.edit')
  removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.membersService.removeMember(
      projectId,
      userId,
      req.user.instanceId,
    );
  }
}
