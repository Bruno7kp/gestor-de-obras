import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  status?: string;
}

interface AssignRoleBody {
  roleId: string;
}

interface SetRolesBody {
  roleIds: string[];
}

interface UpdateSelfBody {
  name?: string;
  email?: string;
  profileImage?: string | null;
}

interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface UpdateUserBody {
  name?: string;
  email?: string;
  password?: string;
}

@Controller('users')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  findAll(@Req() req: AuthenticatedRequest) {
    return this.usersService.findAll(req.user.instanceId);
  }

  @Get('me')
  getMe(@Req() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.id, req.user.instanceId);
  }

  @Patch('me')
  updateMe(@Body() body: UpdateSelfBody, @Req() req: AuthenticatedRequest) {
    return this.usersService.updateSelf({
      userId: req.user.id,
      instanceId: req.user.instanceId,
      ...body,
    });
  }

  @Patch('me/password')
  updatePassword(@Body() body: UpdatePasswordBody, @Req() req: AuthenticatedRequest) {
    return this.usersService.updatePassword({
      userId: req.user.id,
      instanceId: req.user.instanceId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.findById(id, req.user.instanceId);
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  create(@Body() body: CreateUserBody, @Req() req: AuthenticatedRequest) {
    return this.usersService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Post(':id/roles')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  assignRole(
    @Param('id') id: string,
    @Body() body: AssignRoleBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.assignRole({
      userId: id,
      roleId: body.roleId,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id/roles')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  async setRoles(
    @Param('id') id: string,
    @Body() body: SetRolesBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const roleIds = Array.isArray(body.roleIds) ? body.roleIds : [];

    if (req.user.id === id) {
      const names = await this.usersService.resolveRoleNames(roleIds, req.user.instanceId);
      const keepAdmin = names.includes('ADMIN') || names.includes('SUPER_ADMIN') || names.includes('Gestor Principal');
      if (!keepAdmin) {
        throw new ForbiddenException('Admin nao pode alterar a propria role');
      }
    }

    return this.usersService.setRoles({
      userId: id,
      roleIds,
      instanceId: req.user.instanceId,
    });
  }

  @Get(':id/roles')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  listRoles(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.listRoles(id, req.user.instanceId);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  updateUser(
    @Param('id') id: string,
    @Body() body: UpdateUserBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.usersService.updateUser({
      userId: id,
      instanceId: req.user.instanceId,
      ...body,
    });
  }

  @Patch(':id/toggle-status')
  @Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  toggleStatus(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.usersService.toggleStatus(id, req.user.instanceId);
  }
}
