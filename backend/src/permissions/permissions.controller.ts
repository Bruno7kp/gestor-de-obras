import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(AuthGuard('jwt'))
@Roles('ADMIN', 'SUPER_ADMIN')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }
}
