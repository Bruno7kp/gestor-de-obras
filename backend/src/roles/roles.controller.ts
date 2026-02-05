import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesService } from './roles.service';
import { Roles } from '../auth/roles.decorator';

interface CreateRoleBody {
  name: string;
  description?: string;
}

type UpdateRoleBody = Partial<CreateRoleBody>;

interface AddPermissionBody {
  code: string;
  description?: string;
}

@Controller('roles')
@UseGuards(AuthGuard('jwt'))
@Roles('ADMIN', 'SUPER_ADMIN')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.rolesService.findAll(req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateRoleBody, @Req() req: any) {
    return this.rolesService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateRoleBody, @Req() req: any) {
    return this.rolesService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.rolesService.remove(id, req.user.instanceId);
  }

  @Post(':id/permissions')
  addPermission(@Param('id') id: string, @Body() body: AddPermissionBody, @Req() req: any) {
    return this.rolesService.addPermission({
      roleId: id,
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id/permissions/:permissionId')
  removePermission(@Param('id') id: string, @Param('permissionId') permissionId: string, @Req() req: any) {
    return this.rolesService.removePermission(id, permissionId, req.user.instanceId);
  }
}
