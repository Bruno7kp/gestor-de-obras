import { Module } from '@nestjs/common';
import { GlobalSettingsController } from './global-settings.controller';
import { GlobalSettingsService } from './global-settings.service';

@Module({
  controllers: [GlobalSettingsController],
  providers: [GlobalSettingsService],
})
export class GlobalSettingsModule {}
