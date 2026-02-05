import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SuppliersService } from './suppliers.service';
import { Roles } from '../auth/roles.decorator';

interface CreateSupplierBody {
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  rating: number;
  notes?: string;
  order?: number;
}

type UpdateSupplierBody = Partial<CreateSupplierBody>;

@Controller('suppliers')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.suppliersService.findAll(req.user.instanceId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: any) {
    return this.suppliersService.findById(id, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateSupplierBody, @Req() req: any) {
    return this.suppliersService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSupplierBody, @Req() req: any) {
    return this.suppliersService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.suppliersService.remove(id, req.user.instanceId);
  }
}
