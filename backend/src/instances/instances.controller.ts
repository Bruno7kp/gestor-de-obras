import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InstancesService } from './instances.service';
import { Roles } from '../auth/roles.decorator';

interface CreateInstanceBody {
  name: string;
  status?: string;
  admin?: {
    name: string;
    email: string;
    password: string;
  };
}

interface UpdateInstanceBody {
  name?: string;
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

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateInstanceBody,
  ): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.instancesService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return this.instancesService.delete(id);
  }
}
