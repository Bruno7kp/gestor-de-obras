import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';

interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  status?: string;
}

interface AssignRoleBody {
  roleId: string;
}

@Controller('users')
@UseGuards(AuthGuard('jwt'))
@Roles('ADMIN', 'SUPER_ADMIN')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.instanceId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findById(id, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateUserBody, @Req() req: any) {
    return this.usersService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Post(':id/roles')
  assignRole(@Param('id') id: string, @Body() body: AssignRoleBody, @Req() req: any) {
    return this.usersService.assignRole({
      userId: id,
      roleId: body.roleId,
      instanceId: req.user.instanceId,
    });
  }

  @Get(':id/roles')
  listRoles(@Param('id') id: string, @Req() req: any) {
    return this.usersService.listRoles(id, req.user.instanceId);
  }
}
