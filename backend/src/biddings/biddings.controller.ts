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
import { BiddingsService } from './biddings.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

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
  findAll(@Req() req: AuthenticatedRequest) {
    return this.biddingsService.findAll(req.user.instanceId);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.biddingsService.findById(id, req.user.instanceId);
  }

  @Post()
  @HasPermission('biddings.edit')
  create(@Body() body: CreateBiddingBody, @Req() req: AuthenticatedRequest) {
    return this.biddingsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Patch(':id')
  @HasPermission('biddings.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateBiddingBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.biddingsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('biddings.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.biddingsService.remove(id, req.user.instanceId, req.user.id);
  }
}
