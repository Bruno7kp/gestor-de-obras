import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalSettingsService } from './global-settings.service';
import { Roles } from '../auth/roles.decorator';

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
  expirationDate: string;
  status: string;
}

@Controller('global-settings')
@UseGuards(AuthGuard('jwt'))
@Roles('ADMIN', 'SUPER_ADMIN')
export class GlobalSettingsController {
  constructor(private readonly settingsService: GlobalSettingsService) {}

  @Get()
  getSettings(@Req() req: any) {
    return this.settingsService.getSettings(req.user.instanceId);
  }

  @Patch()
  updateSettings(@Body() body: UpdateGlobalSettingsBody, @Req() req: any) {
    return this.settingsService.updateSettings({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Post('certificates')
  addCertificate(@Body() body: CreateCertificateBody, @Req() req: any) {
    return this.settingsService.addCertificate({
      ...body,
      instanceId: req.user.instanceId,
    });
  }

  @Delete('certificates/:id')
  removeCertificate(@Param('id') id: string, @Req() req: any) {
    return this.settingsService.removeCertificate(id, req.user.instanceId);
  }
}
