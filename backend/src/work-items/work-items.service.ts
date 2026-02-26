import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';
import { JournalService } from '../journal/journal.service';

interface CreateWorkItemInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  parentId?: string | null;
  name: string;
  type: string;
  scope?: string;
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

interface UpdateWorkItemInput extends Partial<CreateWorkItemInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly journalService: JournalService,
  ) {}

  private async emitWorkItemJournalEntry(
    instanceId: string,
    item: { projectId: string; wbs: string; name: string },
  ) {
    await this.journalService.createEntry({
      projectId: item.projectId,
      instanceId,
      timestamp: new Date().toISOString(),
      type: 'AUTO',
      category: 'PROGRESS',
      title: `Marco de Execução: ${item.wbs}`,
      description: `O serviço "${item.name}" foi concluído fisicamente (100% acumulado).`,
      photoUrls: [],
    });
  }

  private chunkItems<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
    writable = false,
  ) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);
    if (writable) {
      await ensureProjectWritable(this.prisma, projectId);
    }
  }

  async findAll(projectId: string, instanceId: string, userId?: string, scope?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const where: any = { projectId };
    if (scope) where.scope = scope;
    return this.prisma.workItem.findMany({
      where,
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateWorkItemInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);
    return this.prisma.workItem.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        name: input.name,
        type: input.type,
        scope: input.scope || 'wbs',
        wbs: input.wbs || '',
        order: input.order ?? 0,
        unit: input.unit || 'un',
        cod: input.cod || null,
        fonte: input.fonte || null,
        contractQuantity: input.contractQuantity ?? 0,
        unitPrice: input.unitPrice ?? 0,
        unitPriceNoBdi: input.unitPriceNoBdi ?? 0,
        contractTotal: input.contractTotal ?? 0,
        previousQuantity: input.previousQuantity ?? 0,
        previousTotal: input.previousTotal ?? 0,
        currentQuantity: input.currentQuantity ?? 0,
        currentTotal: input.currentTotal ?? 0,
        currentPercentage: input.currentPercentage ?? 0,
        accumulatedQuantity: input.accumulatedQuantity ?? 0,
        accumulatedTotal: input.accumulatedTotal ?? 0,
        accumulatedPercentage: input.accumulatedPercentage ?? 0,
        balanceQuantity: input.balanceQuantity ?? 0,
        balanceTotal: input.balanceTotal ?? 0,
      },
    });
  }

  async replaceAll(
    projectId: string,
    items: Array<Omit<CreateWorkItemInput, 'instanceId'>>,
    instanceId: string,
    userId?: string,
    scope?: string,
  ): Promise<{ created: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);

    const effectiveScope = scope || 'wbs';
    // Prepare data for bulk insert
    const createData = items.map((i) => ({
      id: i.id,
      projectId: projectId,
      parentId: i.parentId ?? null,
      name: i.name,
      type: i.type,
      scope: i.scope || effectiveScope,
      wbs: i.wbs || '',
      order: i.order ?? 0,
      unit: i.unit || 'un',
      cod: i.cod ?? null,
      fonte: i.fonte ?? null,
      contractQuantity: i.contractQuantity ?? 0,
      unitPrice: i.unitPrice ?? 0,
      unitPriceNoBdi: i.unitPriceNoBdi ?? 0,
      contractTotal: i.contractTotal ?? 0,
      previousQuantity: i.previousQuantity ?? 0,
      previousTotal: i.previousTotal ?? 0,
      currentQuantity: i.currentQuantity ?? 0,
      currentTotal: i.currentTotal ?? 0,
      currentPercentage: i.currentPercentage ?? 0,
      accumulatedQuantity: i.accumulatedQuantity ?? 0,
      accumulatedTotal: i.accumulatedTotal ?? 0,
      accumulatedPercentage: i.accumulatedPercentage ?? 0,
      balanceQuantity: i.balanceQuantity ?? 0,
      balanceTotal: i.balanceTotal ?? 0,
    }));

    const chunks = this.chunkItems(createData, 200);
    const scopeFilter = { projectId, scope: effectiveScope };

    await this.prisma.$transaction(async (tx) => {
      await tx.laborContractWorkItem.deleteMany({
        where: { workItem: scopeFilter },
      });
      await tx.laborContract.updateMany({
        where: { projectId, linkedWorkItem: { scope: effectiveScope } },
        data: { linkedWorkItemId: null },
      });
      await tx.workItemResponsibility.deleteMany({
        where: { workItem: scopeFilter },
      });
      await tx.workItem.deleteMany({ where: scopeFilter });

      for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        await tx.workItem.createMany({ data: chunk });
      }
    });

    return { created: items.length };
  }

  async batchInsert(
    projectId: string,
    items: Array<Omit<CreateWorkItemInput, 'instanceId'>>,
    replaceFlag: boolean,
    instanceId: string,
    userId?: string,
    scope?: string,
  ): Promise<{ created: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);

    const effectiveScope = scope || 'wbs';
    const createData = items.map((i) => ({
      id: i.id,
      projectId: projectId,
      parentId: i.parentId ?? null,
      name: i.name,
      type: i.type,
      scope: i.scope || effectiveScope,
      wbs: i.wbs || '',
      order: i.order ?? 0,
      unit: i.unit || 'un',
      cod: i.cod ?? null,
      fonte: i.fonte ?? null,
      contractQuantity: i.contractQuantity ?? 0,
      unitPrice: i.unitPrice ?? 0,
      unitPriceNoBdi: i.unitPriceNoBdi ?? 0,
      contractTotal: i.contractTotal ?? 0,
      previousQuantity: i.previousQuantity ?? 0,
      previousTotal: i.previousTotal ?? 0,
      currentQuantity: i.currentQuantity ?? 0,
      currentTotal: i.currentTotal ?? 0,
      currentPercentage: i.currentPercentage ?? 0,
      accumulatedQuantity: i.accumulatedQuantity ?? 0,
      accumulatedTotal: i.accumulatedTotal ?? 0,
      accumulatedPercentage: i.accumulatedPercentage ?? 0,
      balanceQuantity: i.balanceQuantity ?? 0,
      balanceTotal: i.balanceTotal ?? 0,
    }));

    const chunks = this.chunkItems(createData, 200);

    if (replaceFlag) {
      const scopeFilter = { projectId, scope: effectiveScope };
      await this.prisma.$transaction(async (tx) => {
        await tx.laborContractWorkItem.deleteMany({
          where: { workItem: scopeFilter },
        });
        await tx.laborContract.updateMany({
          where: { projectId, linkedWorkItem: { scope: effectiveScope } },
          data: { linkedWorkItemId: null },
        });
        await tx.workItemResponsibility.deleteMany({
          where: { workItem: scopeFilter },
        });
        await tx.workItem.deleteMany({ where: scopeFilter });
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          await tx.workItem.createMany({ data: chunk });
        }
      });
    } else {
      // Only insert provided batch
      for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        await this.prisma.workItem.createMany({ data: chunk });
      }
    }

    return { created: items.length };
  }

  async update(input: UpdateWorkItemInput) {
    let existing = await this.prisma.workItem.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });

    // Fallback: check cross-instance project membership
    if (!existing && input.userId) {
      const item = await this.prisma.workItem.findFirst({
        where: { id: input.id },
        include: { project: { select: { id: true } } },
      });
      if (item) {
        const membership = await this.prisma.projectMember.findFirst({
          where: { projectId: item.project.id, user: { id: input.userId } },
        });
        if (membership) existing = item;
      }
    }

    if (!existing) throw new NotFoundException('Item nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    const nextAccumulatedPercentage =
      input.accumulatedPercentage ?? existing.accumulatedPercentage;

    const updated = await this.prisma.workItem.update({
      where: { id: input.id },
      data: {
        parentId: input.parentId === undefined ? existing.parentId : input.parentId,
        name: input.name ?? existing.name,
        type: input.type ?? existing.type,
        wbs: input.wbs ?? existing.wbs,
        order: input.order ?? existing.order,
        unit: input.unit ?? existing.unit,
        cod: input.cod ?? existing.cod,
        fonte: input.fonte ?? existing.fonte,
        contractQuantity: input.contractQuantity ?? existing.contractQuantity,
        unitPrice: input.unitPrice ?? existing.unitPrice,
        unitPriceNoBdi: input.unitPriceNoBdi ?? existing.unitPriceNoBdi,
        contractTotal: input.contractTotal ?? existing.contractTotal,
        previousQuantity: input.previousQuantity ?? existing.previousQuantity,
        previousTotal: input.previousTotal ?? existing.previousTotal,
        currentQuantity: input.currentQuantity ?? existing.currentQuantity,
        currentTotal: input.currentTotal ?? existing.currentTotal,
        currentPercentage:
          input.currentPercentage ?? existing.currentPercentage,
        accumulatedQuantity:
          input.accumulatedQuantity ?? existing.accumulatedQuantity,
        accumulatedTotal: input.accumulatedTotal ?? existing.accumulatedTotal,
        accumulatedPercentage:
          input.accumulatedPercentage ?? existing.accumulatedPercentage,
        balanceQuantity: input.balanceQuantity ?? existing.balanceQuantity,
        balanceTotal: input.balanceTotal ?? existing.balanceTotal,
      },
    });

    const crossedCompletion =
      existing.type === 'item' &&
      existing.accumulatedPercentage < 100 &&
      nextAccumulatedPercentage >= 100;

    if (crossedCompletion && input.instanceId) {
      void this.notificationsService
        .emit({
          instanceId: input.instanceId,
          projectId: updated.projectId,
          category: 'PROGRESS',
          eventType: 'WORKITEM_COMPLETED',
          priority: 'normal',
          title: `Marco de Execução: ${updated.wbs}`,
          body: `O serviço "${updated.name}" foi concluído fisicamente (100% acumulado).`,
          dedupeKey: `workitem:${updated.id}:COMPLETED`,
          permissionCodes: ['wbs.view', 'wbs.edit', 'planning.view', 'planning.edit'],
          includeProjectMembers: true,
          metadata: {
            workItemId: updated.id,
            wbs: updated.wbs,
          },
        })
        .catch(() => undefined);

      void this.emitWorkItemJournalEntry(input.instanceId, {
        projectId: updated.projectId,
        wbs: updated.wbs,
        name: updated.name,
      }).catch(() => undefined);
    }

    return updated;
  }

  private collectDescendants(
    items: { id: string; parentId: string | null }[],
    id: string,
  ) {
    const ids = new Set<string>([id]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const item of items) {
        if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
          ids.add(item.id);
          changed = true;
        }
      }
    }

    return Array.from(ids);
  }

  async remove(id: string, instanceId: string, userId?: string) {
    let target = await this.prisma.workItem.findFirst({
      where: { id, project: { instanceId } },
      select: { id: true, projectId: true },
    });

    // Fallback: check cross-instance project membership
    if (!target && userId) {
      const item = await this.prisma.workItem.findFirst({
        where: { id },
        select: { id: true, projectId: true },
      });
      if (item) {
        const membership = await this.prisma.projectMember.findFirst({
          where: { projectId: item.projectId, user: { id: userId } },
        });
        if (membership) target = item;
      }
    }

    if (!target) throw new NotFoundException('Item nao encontrado');

    await ensureProjectWritable(this.prisma, target.projectId);

    const allItems = await this.prisma.workItem.findMany({
      where: { projectId: target.projectId },
      select: { id: true, parentId: true },
    });

    const ids = this.collectDescendants(allItems, id);

    await this.prisma.workItemResponsibility.deleteMany({
      where: { workItemId: { in: ids } },
    });

    await this.prisma.workItem.deleteMany({
      where: { id: { in: ids } },
    });

    return { deleted: ids.length };
  }
}
