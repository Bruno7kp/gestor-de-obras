import { Module } from '@nestjs/common';
import { LaborContractsController } from './labor-contracts.controller';
import { LaborContractsService } from './labor-contracts.service';

@Module({
  controllers: [LaborContractsController],
  providers: [LaborContractsService],
})
export class LaborContractsModule {}
