import { Module } from '@nestjs/common';
import { BlueprintItemsController } from './blueprint-items.controller';
import { BlueprintItemsService } from './blueprint-items.service';

@Module({
  controllers: [BlueprintItemsController],
  providers: [BlueprintItemsService],
})
export class BlueprintItemsModule {}
