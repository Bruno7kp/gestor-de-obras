import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InstancesService } from './instances.service';
import { Roles } from '../auth/roles.decorator';

interface CreateInstanceBody {
  name: string;
  status?: string;
}

@Controller('instances')
@UseGuards(AuthGuard('jwt'))
@Roles('SUPER_ADMIN')
export class InstancesController {
  constructor(private readonly instancesService: InstancesService) {}

  @Get()
  findAll() {
    return this.instancesService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.instancesService.findById(id);
  }

  @Post()
  create(@Body() body: CreateInstanceBody) {
    return this.instancesService.create(body);
  }
}
