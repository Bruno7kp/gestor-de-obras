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
import { JournalService } from './journal.service';
import { Roles } from '../auth/roles.decorator';
import { HasPermission } from '../auth/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface CreateJournalEntryBody {
  id?: string;
  projectId: string;
  timestamp: string;
  type: string;
  category: string;
  title: string;
  description: string;
  weatherStatus?: string | null;
  photoUrls?: string[];
}

type UpdateJournalEntryBody = Partial<CreateJournalEntryBody>;

@Controller('journal')
@UseGuards(AuthGuard('jwt'))
@Roles('USER', 'ADMIN', 'SUPER_ADMIN')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get('entries')
  listEntries(
    @Query('projectId') projectId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.journalService.listEntries(projectId, req.user.instanceId);
  }

  @Post('entries')
  @HasPermission('journal.edit')
  createEntry(
    @Body() body: CreateJournalEntryBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.journalService.createEntry({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('entries/:id')
  @HasPermission('journal.edit')
  updateEntry(
    @Param('id') id: string,
    @Body() body: UpdateJournalEntryBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.journalService.updateEntry(id, req.user.instanceId, body);
  }

  @Delete('entries/:id')
  @HasPermission('journal.edit')
  deleteEntry(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.journalService.deleteEntry(id, req.user.instanceId);
  }
}
