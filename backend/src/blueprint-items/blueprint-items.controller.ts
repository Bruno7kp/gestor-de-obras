import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { BlueprintItemsService } from './blueprint-items.service';

interface BlueprintItemBody {
  id?: string;
  projectId: string;
  parentId?: string | null;
  name: string;
  type: string;
  wbs?: string;
  order?: number;
  unit?: string;
  cod?: string;
  fonte?: string;
  contractQuantity?: number;
  unitPrice?: number;
  unitPriceNoBdi?: number;
  contractTotal?: number;
  previousQuantity?: number;
  previousTotal?: number;
  currentQuantity?: number;
  currentTotal?: number;
  currentPercentage?: number;
  accumulatedQuantity?: number;
  accumulatedTotal?: number;
  accumulatedPercentage?: number;
  balanceQuantity?: number;
  balanceTotal?: number;
}

type UpdateBlueprintItemBody = Partial<BlueprintItemBody>;

@Controller('blueprint-items')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class BlueprintItemsController {
  constructor(private readonly blueprintItemsService: BlueprintItemsService) {}

  @Get()
  @HasPermission('blueprint.view', 'blueprint.edit')
  findAll(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueprintItemsService.findAll(
      projectId,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post()
  @HasPermission('blueprint.edit')
  create(@Body() body: BlueprintItemBody, @Req() req: AuthenticatedRequest) {
    return this.blueprintItemsService.create({
      ...body,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Post('replace')
  @HasPermission('blueprint.edit')
  replace(
    @Body() body: { projectId: string; items: BlueprintItemBody[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueprintItemsService.replaceAll(
      body.projectId,
      body.items,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Post('batch')
  @HasPermission('blueprint.edit')
  batch(
    @Body()
    body: { projectId: string; items: BlueprintItemBody[]; replace?: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueprintItemsService.batchInsert(
      body.projectId,
      body.items,
      !!body.replace,
      req.user.instanceId,
      req.user.id,
    );
  }

  @Patch('batch-update')
  @HasPermission('blueprint.edit')
  batchUpdate(
    @Body()
    body: {
      projectId: string;
      updates: Array<{ id: string } & UpdateBlueprintItemBody>;
      operation?: string;
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueprintItemsService.batchUpdate(
      body.projectId,
      body.updates.map((u) => ({
        ...u,
        instanceId: req.user.instanceId,
        userId: req.user.id,
      })),
      req.user.instanceId,
      req.user.id,
      body.operation,
    );
  }

  @Patch(':id')
  @HasPermission('blueprint.edit')
  update(
    @Param('id') id: string,
    @Body() body: UpdateBlueprintItemBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.blueprintItemsService.update({
      ...body,
      id,
      instanceId: req.user.instanceId,
      userId: req.user.id,
    });
  }

  @Delete(':id')
  @HasPermission('blueprint.edit')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.blueprintItemsService.remove(id, req.user.instanceId, req.user.id);
  }
}
