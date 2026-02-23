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
import { GlobalSettingsService } from './global-settings.service';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';

interface UpdateGlobalSettingsBody {
  defaultCompanyName?: string;
  companyCnpj?: string;
  userName?: string;
  language?: string;
  currencySymbol?: string;
}

interface CreateCertificateBody {
  name: string;
  issuer: string;
  category?: string;
  expirationDate?: string | null;
  status: string;
  attachmentUrls?: string[];
}

type UpdateCertificateBody = Partial<CreateCertificateBody>;

@Controller('global-settings')
@UseGuards(AuthGuard('jwt'))
@Roles('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
export class GlobalSettingsController {
  constructor(private readonly settingsService: GlobalSettingsService) {}

  private parseAttachmentUrls(value: unknown): string[] | undefined {
    if (value === undefined || value === null) return undefined;

    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean);
        }
      } catch {
        // ignore
      }

      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed
          .slice(1, -1)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }

      return [trimmed];
    }

    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>)
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return undefined;
  }

  @Get()
  getSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getSettings(req.user.instanceId);
  }

  @Patch()
  updateSettings(
    @Body() body: UpdateGlobalSettingsBody,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settingsService.updateSettings({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Post('certificates')
  addCertificate(
    @Body() body: CreateCertificateBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const parsedAttachmentUrls = this.parseAttachmentUrls(
      (body as any).attachmentUrls,
    );

    return this.settingsService.addCertificate({
      ...body,
      attachmentUrls: parsedAttachmentUrls,
      instanceId: req.user.instanceId,
    });
  }

  @Patch('certificates/:id')
  updateCertificate(
    @Param('id') id: string,
    @Body() body: UpdateCertificateBody,
    @Req() req: AuthenticatedRequest,
  ) {
    const parsedAttachmentUrls = this.parseAttachmentUrls(
      (body as any).attachmentUrls,
    );

    return this.settingsService.updateCertificate(id, {
      ...body,
      attachmentUrls: parsedAttachmentUrls,
      instanceId: req.user.instanceId,
    });
  }

  @Delete('certificates/:id')
  removeCertificate(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.settingsService.removeCertificate(id, req.user.instanceId);
  }
}
