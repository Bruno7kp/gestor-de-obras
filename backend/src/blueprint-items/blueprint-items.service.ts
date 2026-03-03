import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';

interface CreateBlueprintItemInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
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

interface UpdateBlueprintItemInput extends Partial<CreateBlueprintItemInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class BlueprintItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private chunkItems<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  private blueprintModel(client: unknown = this.prisma) {
    return (client as { blueprintItem: any }).blueprintItem;
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

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.blueprintModel().findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateBlueprintItemInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);

    const created = await this.blueprintModel().create({
      data: {
        id: input.id,
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        name: input.name,
        type: input.type,
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

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'BlueprintItem',
      entityId: created.id,
      after: created as Record<string, unknown>,
    });

    return created;
  }

  async replaceAll(
    projectId: string,
    items: Array<Omit<CreateBlueprintItemInput, 'instanceId'>>,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureProject(projectId, instanceId, userId, true);

    const createData = items.map((item) => ({
      id: item.id,
      projectId,
      parentId: item.parentId ?? null,
      name: item.name,
      type: item.type,
      wbs: item.wbs || '',
      order: item.order ?? 0,
      unit: item.unit || 'un',
      cod: item.cod ?? null,
      fonte: item.fonte ?? null,
      contractQuantity: item.contractQuantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
      unitPriceNoBdi: item.unitPriceNoBdi ?? 0,
      contractTotal: item.contractTotal ?? 0,
      previousQuantity: item.previousQuantity ?? 0,
      previousTotal: item.previousTotal ?? 0,
      currentQuantity: item.currentQuantity ?? 0,
      currentTotal: item.currentTotal ?? 0,
      currentPercentage: item.currentPercentage ?? 0,
      accumulatedQuantity: item.accumulatedQuantity ?? 0,
      accumulatedTotal: item.accumulatedTotal ?? 0,
      accumulatedPercentage: item.accumulatedPercentage ?? 0,
      balanceQuantity: item.balanceQuantity ?? 0,
      balanceTotal: item.balanceTotal ?? 0,
    }));

    const chunks = this.chunkItems(createData, 200);

    await this.prisma.$transaction(async (tx) => {
      await this.blueprintModel(tx).deleteMany({ where: { projectId } });
      for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        await this.blueprintModel(tx).createMany({ data: chunk });
      }
    });

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'CREATE',
      model: 'BlueprintItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: 'replaceAll',
        count: items.length,
      },
    });

    return { created: items.length };
  }

  async batchInsert(
    projectId: string,
    items: Array<Omit<CreateBlueprintItemInput, 'instanceId'>>,
    replaceFlag: boolean,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureProject(projectId, instanceId, userId, true);

    const createData = items.map((item) => ({
      id: item.id,
      projectId,
      parentId: item.parentId ?? null,
      name: item.name,
      type: item.type,
      wbs: item.wbs || '',
      order: item.order ?? 0,
      unit: item.unit || 'un',
      cod: item.cod ?? null,
      fonte: item.fonte ?? null,
      contractQuantity: item.contractQuantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
      unitPriceNoBdi: item.unitPriceNoBdi ?? 0,
      contractTotal: item.contractTotal ?? 0,
      previousQuantity: item.previousQuantity ?? 0,
      previousTotal: item.previousTotal ?? 0,
      currentQuantity: item.currentQuantity ?? 0,
      currentTotal: item.currentTotal ?? 0,
      currentPercentage: item.currentPercentage ?? 0,
      accumulatedQuantity: item.accumulatedQuantity ?? 0,
      accumulatedTotal: item.accumulatedTotal ?? 0,
      accumulatedPercentage: item.accumulatedPercentage ?? 0,
      balanceQuantity: item.balanceQuantity ?? 0,
      balanceTotal: item.balanceTotal ?? 0,
    }));

    const chunks = this.chunkItems(createData, 200);

    if (replaceFlag) {
      await this.prisma.$transaction(async (tx) => {
        await this.blueprintModel(tx).deleteMany({ where: { projectId } });
        for (const chunk of chunks) {
          if (chunk.length === 0) continue;
          await this.blueprintModel(tx).createMany({ data: chunk });
        }
      });
    } else {
      for (const chunk of chunks) {
        if (chunk.length === 0) continue;
        await this.blueprintModel().createMany({ data: chunk });
      }
    }

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'CREATE',
      model: 'BlueprintItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: replaceFlag ? 'batchInsertReplace' : 'batchInsert',
        count: items.length,
      },
    });

    return { created: items.length };
  }

  async batchUpdate(
    projectId: string,
    updates: UpdateBlueprintItemInput[],
    instanceId: string,
    userId?: string,
    operation?: string,
  ) {
    if (updates.length === 0) return [];

    await this.ensureProject(projectId, instanceId, userId, true);

    const ids = updates.map((update) => update.id);
    const existingItems = await this.blueprintModel().findMany({
      where: { id: { in: ids }, projectId },
    });

    const existingMap = new Map<string, any>(
      existingItems.map((item: any) => [item.id, item] as const),
    );

    const txOps = updates
      .filter((update) => existingMap.has(update.id))
      .map((input) => {
        const existing = existingMap.get(input.id) as any;
        return this.blueprintModel().update({
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
            currentPercentage: input.currentPercentage ?? existing.currentPercentage,
            accumulatedQuantity: input.accumulatedQuantity ?? existing.accumulatedQuantity,
            accumulatedTotal: input.accumulatedTotal ?? existing.accumulatedTotal,
            accumulatedPercentage:
              input.accumulatedPercentage ?? existing.accumulatedPercentage,
            balanceQuantity: input.balanceQuantity ?? existing.balanceQuantity,
            balanceTotal: input.balanceTotal ?? existing.balanceTotal,
          },
        });
      });

    const chunks = this.chunkItems(txOps, 50);
    const results: Array<{ id: string; wbs: string; name: string; type: string }> = [];

    for (const chunk of chunks) {
      const chunkResults = await this.prisma.$transaction(chunk);
      results.push(
        ...chunkResults.map((item) => ({
          id: item.id,
          wbs: item.wbs,
          name: item.name,
          type: item.type,
        })),
      );
    }

    const auditInput = {
      instanceId,
      userId,
      projectId,
      action: 'UPDATE' as const,
      model: 'BlueprintItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: operation || 'batchUpdate',
        count: results.length,
        itemIds: ids,
      },
    };

    if (operation === 'cellEdit') {
      void this.auditService.logThrottled(auditInput);
    } else {
      void this.auditService.log(auditInput);
    }

    return results;
  }

  async update(input: UpdateBlueprintItemInput) {
    let existing = await this.blueprintModel().findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });

    if (!existing && input.userId) {
      const item = await this.blueprintModel().findFirst({
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

    if (!existing) throw new NotFoundException('Item de quantitativo nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    const updated = await this.blueprintModel().update({
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
        currentPercentage: input.currentPercentage ?? existing.currentPercentage,
        accumulatedQuantity: input.accumulatedQuantity ?? existing.accumulatedQuantity,
        accumulatedTotal: input.accumulatedTotal ?? existing.accumulatedTotal,
        accumulatedPercentage:
          input.accumulatedPercentage ?? existing.accumulatedPercentage,
        balanceQuantity: input.balanceQuantity ?? existing.balanceQuantity,
        balanceTotal: input.balanceTotal ?? existing.balanceTotal,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId!,
      userId: input.userId,
      projectId: existing.projectId,
      action: 'UPDATE',
      model: 'BlueprintItem',
      entityId: input.id,
      before: existing as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return updated;
  }

  private collectDescendants(items: { id: string; parentId: string | null }[], id: string) {
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
    let target = await this.blueprintModel().findFirst({
      where: { id, project: { instanceId } },
      select: { id: true, projectId: true },
    });

    if (!target && userId) {
      const item = await this.blueprintModel().findFirst({
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

    if (!target) throw new NotFoundException('Item de quantitativo nao encontrado');

    await ensureProjectWritable(this.prisma, target.projectId);

    const allItems = await this.blueprintModel().findMany({
      where: { projectId: target.projectId },
      select: { id: true, parentId: true },
    });

    const ids = this.collectDescendants(allItems, id);

    await this.blueprintModel().deleteMany({
      where: { id: { in: ids } },
    });

    void this.auditService.log({
      instanceId,
      userId,
      projectId: target.projectId,
      action: 'DELETE',
      model: 'BlueprintItem',
      entityId: id,
      before: target as Record<string, unknown>,
      metadata: { deletedIds: ids },
    });

    return { deleted: ids.length };
  }
}
