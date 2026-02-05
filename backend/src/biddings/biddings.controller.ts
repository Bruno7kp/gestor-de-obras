import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BiddingsService } from './biddings.service';
import { Roles } from '../auth/roles.decorator';

interface CreateBiddingBody {
  tenderNumber: string;
  clientName: string;
  object: string;
  openingDate: string;
  expirationDate: string;
  estimatedValue: number;
  ourProposalValue: number;
  status: string;
  bdi: number;
  itemsSnapshot?: unknown;
  assetsSnapshot?: unknown;
}

type UpdateBiddingBody = Partial<CreateBiddingBody>;

@Controller('biddings')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class BiddingsController {
  constructor(private readonly biddingsService: BiddingsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.biddingsService.findAll(req.user.instanceId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: any) {
    return this.biddingsService.findById(id, req.user.instanceId);
  }

  @Post()
  create(@Body() body: CreateBiddingBody, @Req() req: any) {
    return this.biddingsService.create({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBiddingBody, @Req() req: any) {
    return this.biddingsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.biddingsService.remove(id, req.user.instanceId);
  }
}
