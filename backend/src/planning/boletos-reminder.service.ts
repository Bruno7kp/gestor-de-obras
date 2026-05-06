import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningService } from './planning.service';

@Injectable()
export class BoletosReminderService {
  private readonly logger = new Logger(BoletosReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly planningService: PlanningService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async runDailyDueSoonScan() {
    const instanceIds = await this.prisma.instance.findMany({
      select: { id: true },
    });

    for (const instance of instanceIds) {
      try {
        await this.planningService.scanDueSoonBoletos(instance.id);
      } catch (error) {
        this.logger.error(
          `Falha ao processar lembretes de boletos para instancia ${instance.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

