import {
  ForbiddenException,
  INestApplication,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });

    const middlewareApi = (
      this as unknown as {
        $use?: (
          cb: (
            params: {
              action: string;
              model?: string;
              args?: Record<string, unknown>;
            },
            next: (params: unknown) => Promise<unknown>,
          ) => Promise<unknown>,
        ) => void;
      }
    ).$use;
    if (typeof middlewareApi !== 'function') {
      return;
    }

    middlewareApi.call(
      this,
      async (
        params: {
          action: string;
          model?: string;
          args?: Record<string, unknown>;
        },
        next: (params: unknown) => Promise<unknown>,
      ) => {
        const isWriteAction = [
          'create',
          'createMany',
          'update',
          'updateMany',
          'upsert',
          'delete',
          'deleteMany',
        ].includes(params.action);

        if (!isWriteAction || !params.model || params.model === 'Project') {
          return next(params);
        }

        const projectIds = await this.resolveProjectIdsFromMutation(
          params.model,
          params.action,
          params.args,
        );
        if (projectIds.length > 0) {
          await this.assertProjectsWritable(projectIds);
        }

        return next(params);
      },
    );
  }

  private async assertProjectsWritable(projectIds: string[]) {
    const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));
    if (uniqueProjectIds.length === 0) return;

    const archived = await this.project.findFirst({
      where: { id: { in: uniqueProjectIds }, isArchived: true },
      select: { id: true },
    });

    if (archived) {
      throw new ForbiddenException(
        'Projeto arquivado. Reative a obra para permitir alteracoes.',
      );
    }
  }

  private normalizeDataArray(data: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
    if (data && typeof data === 'object')
      return [data as Record<string, unknown>];
    return [];
  }

  private async resolveProjectIdsFromMutation(
    model: string,
    _action: string,
    args: Record<string, unknown> | undefined,
  ): Promise<string[]> {
    const fromData = (key: string): string[] =>
      this.normalizeDataArray(args?.data)
        .map((row) => row?.[key])
        .filter((v): v is string => typeof v === 'string');

    const fromUniqueId = async (
      finder: (id: string) => Promise<string | null>,
    ) => {
      const where = args?.where as Record<string, unknown> | undefined;
      const id = where?.id;
      if (!id || typeof id !== 'string') return [];
      const projectId = await finder(id);
      return projectId ? [projectId] : [];
    };

    switch (model) {
      case 'WorkItem':
      case 'ProjectAsset':
      case 'ProjectExpense':
      case 'MeasurementSnapshot':
      case 'WorkforceMember':
      case 'ProjectMember':
      case 'ProjectPlanning':
      case 'ProjectJournal':
      case 'LaborContract': {
        const direct = fromData('projectId');
        if (direct.length > 0) return direct;
      }
    }

    switch (model) {
      case 'WorkItem':
        return fromUniqueId(async (id) => {
          const row = await this.workItem.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'ProjectAsset':
        return fromUniqueId(async (id) => {
          const row = await this.projectAsset.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'ProjectExpense':
        return fromUniqueId(async (id) => {
          const row = await this.projectExpense.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'MeasurementSnapshot':
        return fromUniqueId(async (id) => {
          const row = await this.measurementSnapshot.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'WorkforceMember':
        return fromUniqueId(async (id) => {
          const row = await this.workforceMember.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'ProjectMember':
        return fromUniqueId(async (id) => {
          const row = await this.projectMember.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'ProjectPlanning':
        return fromUniqueId(async (id) => {
          const row = await this.projectPlanning.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'ProjectJournal':
        return fromUniqueId(async (id) => {
          const row = await this.projectJournal.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      case 'LaborContract': {
        const byAssoc = fromData('associadoId');
        if (byAssoc.length > 0) {
          const members = await this.workforceMember.findMany({
            where: { id: { in: byAssoc } },
            select: { projectId: true },
          });
          return members.map((member) => member.projectId);
        }

        return fromUniqueId(async (id) => {
          const row = await this.laborContract.findUnique({
            where: { id },
            select: { projectId: true },
          });
          return row?.projectId ?? null;
        });
      }
      case 'PlanningTask':
      case 'MaterialForecast':
      case 'Milestone':
      case 'SupplyGroup': {
        const planningIds = fromData('projectPlanningId');
        const uniquePlanningIds = Array.from(new Set(planningIds));
        if (uniquePlanningIds.length > 0) {
          const plannings = await this.projectPlanning.findMany({
            where: { id: { in: uniquePlanningIds } },
            select: { projectId: true },
          });
          return plannings.map((planning) => planning.projectId);
        }

        return fromUniqueId(async (id) => {
          const planningIdLookup = async (): Promise<string | null> => {
            if (model === 'PlanningTask') {
              const row = await this.planningTask.findUnique({
                where: { id },
                select: { projectPlanningId: true },
              });
              return row?.projectPlanningId ?? null;
            }
            if (model === 'MaterialForecast') {
              const row = await this.materialForecast.findUnique({
                where: { id },
                select: { projectPlanningId: true },
              });
              return row?.projectPlanningId ?? null;
            }
            if (model === 'Milestone') {
              const row = await this.milestone.findUnique({
                where: { id },
                select: { projectPlanningId: true },
              });
              return row?.projectPlanningId ?? null;
            }
            const row = await this.supplyGroup.findUnique({
              where: { id },
              select: { projectPlanningId: true },
            });
            return row?.projectPlanningId ?? null;
          };

          const projectPlanningId = await planningIdLookup();
          if (!projectPlanningId) return null;

          const planning = await this.projectPlanning.findUnique({
            where: { id: projectPlanningId },
            select: { projectId: true },
          });
          return planning?.projectId ?? null;
        });
      }
      case 'JournalEntry': {
        const journalIds = fromData('projectJournalId');
        const uniqueJournalIds = Array.from(new Set(journalIds));
        if (uniqueJournalIds.length > 0) {
          const journals = await this.projectJournal.findMany({
            where: { id: { in: uniqueJournalIds } },
            select: { projectId: true },
          });
          return journals.map((journal) => journal.projectId);
        }

        return fromUniqueId(async (id) => {
          const row = await this.journalEntry.findUnique({
            where: { id },
            select: { projectJournalId: true },
          });
          if (!row?.projectJournalId) return null;
          const journal = await this.projectJournal.findUnique({
            where: { id: row.projectJournalId },
            select: { projectId: true },
          });
          return journal?.projectId ?? null;
        });
      }
      case 'StaffDocument': {
        const memberIds = fromData('workforceMemberId');
        const uniqueMemberIds = Array.from(new Set(memberIds));
        if (uniqueMemberIds.length > 0) {
          const members = await this.workforceMember.findMany({
            where: { id: { in: uniqueMemberIds } },
            select: { projectId: true },
          });
          return members.map((member) => member.projectId);
        }

        return fromUniqueId(async (id) => {
          const row = await this.staffDocument.findUnique({
            where: { id },
            select: { workforceMemberId: true },
          });
          if (!row?.workforceMemberId) return null;
          const member = await this.workforceMember.findUnique({
            where: { id: row.workforceMemberId },
            select: { projectId: true },
          });
          return member?.projectId ?? null;
        });
      }
      case 'WorkItemResponsibility': {
        const workItemIds = fromData('workItemId');
        const memberIds = fromData('workforceMemberId');
        const resolved: string[] = [];

        if (workItemIds.length > 0) {
          const items = await this.workItem.findMany({
            where: { id: { in: Array.from(new Set(workItemIds)) } },
            select: { projectId: true },
          });
          resolved.push(...items.map((item) => item.projectId));
        }
        if (memberIds.length > 0) {
          const members = await this.workforceMember.findMany({
            where: { id: { in: Array.from(new Set(memberIds)) } },
            select: { projectId: true },
          });
          resolved.push(...members.map((member) => member.projectId));
        }
        if (resolved.length > 0) return resolved;

        return fromUniqueId(async (id) => {
          const row = await this.workItemResponsibility.findUnique({
            where: { id },
            select: { workItemId: true },
          });
          if (!row?.workItemId) return null;
          const item = await this.workItem.findUnique({
            where: { id: row.workItemId },
            select: { projectId: true },
          });
          return item?.projectId ?? null;
        });
      }
      case 'LaborContractWorkItem': {
        const contractIds = fromData('laborContractId');
        const uniqueContractIds = Array.from(new Set(contractIds));
        if (uniqueContractIds.length > 0) {
          const contracts = await this.laborContract.findMany({
            where: { id: { in: uniqueContractIds } },
            select: { projectId: true },
          });
          return contracts.map((contract) => contract.projectId);
        }

        return fromUniqueId(async (id) => {
          const row = await this.laborContractWorkItem.findUnique({
            where: { id },
            select: { laborContractId: true },
          });
          if (!row?.laborContractId) return null;
          const contract = await this.laborContract.findUnique({
            where: { id: row.laborContractId },
            select: { projectId: true },
          });
          return contract?.projectId ?? null;
        });
      }
      case 'LaborPayment': {
        const contractIds = fromData('laborContractId');
        const uniqueContractIds = Array.from(new Set(contractIds));
        if (uniqueContractIds.length > 0) {
          const contracts = await this.laborContract.findMany({
            where: { id: { in: uniqueContractIds } },
            select: { projectId: true },
          });
          return contracts.map((contract) => contract.projectId);
        }

        return fromUniqueId(async (id) => {
          const row = await this.laborPayment.findUnique({
            where: { id },
            select: { laborContractId: true },
          });
          if (!row?.laborContractId) return null;
          const contract = await this.laborContract.findUnique({
            where: { id: row.laborContractId },
            select: { projectId: true },
          });
          return contract?.projectId ?? null;
        });
      }
      default:
        return [];
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  enableShutdownHooks(app: INestApplication) {
    const shutdown = () => {
      void app.close();
    };

    process.on('beforeExit', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
