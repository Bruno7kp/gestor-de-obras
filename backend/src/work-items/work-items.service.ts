import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly auditService: AuditService,
  ) {}

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

  private asNumber(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return value;
  }

  private truncate2(value: number): number {
    return Math.floor((this.asNumber(value) + 0.0000000001) * 100) / 100;
  }

  private round2(value: number): number {
    return Math.round((this.asNumber(value) + Number.EPSILON) * 100) / 100;
  }

  private deriveFields(
    input: Partial<
      Pick<
        CreateWorkItemInput,
        | 'type'
        | 'contractQuantity'
        | 'unitPrice'
        | 'unitPriceNoBdi'
        | 'contractTotal'
        | 'previousQuantity'
        | 'previousTotal'
        | 'currentQuantity'
        | 'currentTotal'
        | 'currentPercentage'
        | 'accumulatedQuantity'
        | 'accumulatedTotal'
        | 'balanceQuantity'
        | 'balanceTotal'
      >
    >,
  ) {
    const type = input.type ?? 'item';

    if (type === 'category') {
      const contractTotal = this.truncate2(input.contractTotal ?? 0);
      const previousTotal = this.truncate2(input.previousTotal ?? 0);
      const currentTotal = this.truncate2(input.currentTotal ?? 0);
      const accumulatedTotal = this.truncate2(previousTotal + currentTotal);
      const accumulatedPercentage =
        contractTotal > 0
          ? this.round2((accumulatedTotal / contractTotal) * 100)
          : 0;

      return {
        contractQuantity: this.round2(input.contractQuantity ?? 0),
        previousQuantity: this.round2(input.previousQuantity ?? 0),
        currentQuantity: this.round2(input.currentQuantity ?? 0),
        accumulatedQuantity: this.round2(input.accumulatedQuantity ?? 0),
        balanceQuantity: this.round2(input.balanceQuantity ?? 0),
        contractTotal,
        previousTotal,
        currentTotal,
        currentPercentage: this.round2(input.currentPercentage ?? 0),
        accumulatedTotal,
        accumulatedPercentage,
        balanceTotal: this.truncate2(contractTotal - accumulatedTotal),
      };
    }

    const contractQuantity = this.round2(input.contractQuantity ?? 0);
    const previousQuantity = this.round2(input.previousQuantity ?? 0);
    const currentQuantity = this.round2(input.currentQuantity ?? 0);
    const unitPrice = this.truncate2(input.unitPrice ?? 0);

    const contractTotal = this.truncate2(contractQuantity * unitPrice);
    const previousTotal = this.truncate2(previousQuantity * unitPrice);
    const currentTotal = this.truncate2(currentQuantity * unitPrice);
    const accumulatedQuantity = this.round2(previousQuantity + currentQuantity);
    const accumulatedTotal = this.truncate2(previousTotal + currentTotal);
    const balanceQuantity = this.round2(contractQuantity - accumulatedQuantity);
    const currentPercentage =
      contractQuantity > 0
        ? this.round2((currentQuantity / contractQuantity) * 100)
        : 0;
    const accumulatedPercentage =
      contractTotal > 0
        ? this.round2((accumulatedTotal / contractTotal) * 100)
        : 0;

    return {
      contractQuantity,
      previousQuantity,
      currentQuantity,
      accumulatedQuantity,
      balanceQuantity,
      contractTotal,
      previousTotal,
      currentTotal,
      currentPercentage,
      accumulatedTotal,
      accumulatedPercentage,
      balanceTotal: this.truncate2(contractTotal - accumulatedTotal),
    };
  }

  private withDerivedValues(input: Partial<CreateWorkItemInput>) {
    const derived = this.deriveFields(input);
    return {
      contractQuantity: derived.contractQuantity,
      unitPrice: this.truncate2(input.unitPrice ?? 0),
      unitPriceNoBdi: this.truncate2(input.unitPriceNoBdi ?? 0),
      contractTotal: derived.contractTotal,
      previousQuantity: derived.previousQuantity,
      previousTotal: derived.previousTotal,
      currentQuantity: derived.currentQuantity,
      currentTotal: derived.currentTotal,
      currentPercentage: derived.currentPercentage,
      accumulatedQuantity: derived.accumulatedQuantity,
      accumulatedTotal: derived.accumulatedTotal,
      accumulatedPercentage: derived.accumulatedPercentage,
      balanceQuantity: derived.balanceQuantity,
      balanceTotal: derived.balanceTotal,
    };
  }

  private sumFromChildren<T extends Record<string, unknown>>(
    children: T[],
    key: keyof T,
  ) {
    return this.truncate2(
      children.reduce(
        (acc, child) => acc + this.asNumber(child[key] as number | undefined),
        0,
      ),
    );
  }

  async findAll(
    projectId: string,
    instanceId: string,
    userId?: string,
    scope?: string,
  ) {
    await this.ensureProject(projectId, instanceId, userId);
    const where: { projectId: string; scope?: string | { not: string } } = {
      projectId,
      scope: scope === 'wbs' ? 'wbs' : { not: 'quantitativo' },
    };
    return this.prisma.workItem.findMany({
      where,
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateWorkItemInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const derivedValues = this.withDerivedValues(input);

    const created = await this.prisma.workItem.create({
      data: {
        id: input.id,
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        name: input.name,
        type: input.type,
        scope: 'wbs',
        wbs: input.wbs || '',
        order: input.order ?? 0,
        unit: input.unit || 'un',
        cod: input.cod || null,
        fonte: input.fonte || null,
        ...derivedValues,
        createdById: input.userId ?? null,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'WorkItem',
      entityId: created.id,
      after: created as Record<string, unknown>,
    });

    return created;
  }

  async replaceAll(
    projectId: string,
    items: Array<Omit<CreateWorkItemInput, 'instanceId'>>,
    instanceId: string,
    userId?: string,
    scope?: string,
  ): Promise<{ created: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);

    const effectiveScope = 'wbs';
    // Prepare data for bulk insert
    const createData = items.map((i) => {
      const derivedValues = this.withDerivedValues(i);
      return {
        id: i.id,
        projectId: projectId,
        parentId: i.parentId ?? null,
        name: i.name,
        type: i.type,
        scope: effectiveScope,
        wbs: i.wbs || '',
        order: i.order ?? 0,
        unit: i.unit || 'un',
        cod: i.cod ?? null,
        fonte: i.fonte ?? null,
        ...derivedValues,
      };
    });

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

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'CREATE',
      model: 'WorkItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: 'replaceAll',
        scope: effectiveScope,
        count: items.length,
      },
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

    const effectiveScope = 'wbs';
    const createData = items.map((i) => {
      const derivedValues = this.withDerivedValues(i);
      return {
        id: i.id,
        projectId: projectId,
        parentId: i.parentId ?? null,
        name: i.name,
        type: i.type,
        scope: effectiveScope,
        wbs: i.wbs || '',
        order: i.order ?? 0,
        unit: i.unit || 'un',
        cod: i.cod ?? null,
        fonte: i.fonte ?? null,
        ...derivedValues,
      };
    });

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

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'CREATE',
      model: 'WorkItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: replaceFlag ? 'batchInsertReplace' : 'batchInsert',
        scope: effectiveScope,
        count: items.length,
      },
    });

    return { created: items.length };
  }

  async batchUpdate(
    projectId: string,
    updates: UpdateWorkItemInput[],
    instanceId: string,
    userId?: string,
    operation?: string,
  ) {
    if (updates.length === 0) return [];

    await this.ensureProject(projectId, instanceId, userId, true);

    // Load all items being updated in a single query
    const ids = updates.map((u) => u.id);
    const existingItems = await this.prisma.workItem.findMany({
      where: { id: { in: ids }, projectId },
    });

    const existingMap = new Map(existingItems.map((item) => [item.id, item]));

    // Build update operations
    const txOps = updates
      .filter((u) => existingMap.has(u.id))
      .map((input) => {
        const existing = existingMap.get(input.id)!;
        const merged = {
          ...existing,
          ...input,
        };
        const derivedValues = this.withDerivedValues({
          type: merged.type,
          contractQuantity: merged.contractQuantity,
          unitPrice: merged.unitPrice,
          unitPriceNoBdi: merged.unitPriceNoBdi,
          contractTotal: merged.contractTotal,
          previousQuantity: merged.previousQuantity,
          previousTotal: merged.previousTotal,
          currentQuantity: merged.currentQuantity,
          currentTotal: merged.currentTotal,
          currentPercentage: merged.currentPercentage,
          accumulatedQuantity: merged.accumulatedQuantity,
          accumulatedTotal: merged.accumulatedTotal,
          accumulatedPercentage: merged.accumulatedPercentage,
          balanceQuantity: merged.balanceQuantity,
          balanceTotal: merged.balanceTotal,
        });
        return this.prisma.workItem.update({
          where: { id: input.id },
          data: {
            parentId:
              input.parentId === undefined ? existing.parentId : input.parentId,
            name: input.name ?? existing.name,
            type: input.type ?? existing.type,
            wbs: input.wbs ?? existing.wbs,
            order: input.order ?? existing.order,
            unit: input.unit ?? existing.unit,
            cod: input.cod ?? existing.cod,
            fonte: input.fonte ?? existing.fonte,
            ...derivedValues,
            updatedById: userId ?? null,
          },
        });
      });

    // Execute all updates in a single transaction (chunked to avoid parameter limits)
    const chunks = this.chunkItems(txOps, 50);
    const results: Array<{
      id: string;
      wbs: string;
      name: string;
      type: string;
    }> = [];
    for (const chunk of chunks) {
      const chunkResults = await this.prisma.$transaction(chunk);
      results.push(
        ...chunkResults.map((r) => ({
          id: r.id,
          wbs: r.wbs,
          name: r.name,
          type: r.type,
        })),
      );
    }

    // Single summary audit log for the entire batch
    // Throttle cellEdit operations (max 1 log per 2 minutes per project)
    const auditInput = {
      instanceId,
      userId,
      projectId,
      action: 'UPDATE' as const,
      model: 'WorkItem',
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

    // Detect completion crossings and emit notifications
    for (const input of updates) {
      const existing = existingMap.get(input.id);
      if (!existing || existing.type !== 'item') continue;
      const nextAccumulated =
        input.accumulatedPercentage ?? existing.accumulatedPercentage;
      if (existing.accumulatedPercentage < 100 && nextAccumulated >= 100) {
        const updated = results.find((r) => r.id === input.id);
        if (!updated) continue;

        void this.notificationsService
          .emit({
            instanceId,
            projectId,
            category: 'PROGRESS',
            eventType: 'WORKITEM_COMPLETED',
            priority: 'normal',
            title: `Marco de Execução: ${updated.wbs}`,
            body: `O serviço "${updated.name}" foi concluído fisicamente (100% acumulado).`,
            dedupeKey: `workitem:${updated.id}:COMPLETED`,
            permissionCodes: [
              'wbs.view',
              'wbs.edit',
              'planning.view',
              'planning.edit',
            ],
            includeProjectMembers: true,
            metadata: {
              workItemId: updated.id,
              wbs: updated.wbs,
            },
          })
          .catch(() => undefined);

      }
    }

    return results;
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

    const merged = {
      ...existing,
      ...input,
    };
    const derivedValues = this.withDerivedValues({
      type: merged.type,
      contractQuantity: merged.contractQuantity,
      unitPrice: merged.unitPrice,
      unitPriceNoBdi: merged.unitPriceNoBdi,
      contractTotal: merged.contractTotal,
      previousQuantity: merged.previousQuantity,
      previousTotal: merged.previousTotal,
      currentQuantity: merged.currentQuantity,
      currentTotal: merged.currentTotal,
      currentPercentage: merged.currentPercentage,
      accumulatedQuantity: merged.accumulatedQuantity,
      accumulatedTotal: merged.accumulatedTotal,
      accumulatedPercentage: merged.accumulatedPercentage,
      balanceQuantity: merged.balanceQuantity,
      balanceTotal: merged.balanceTotal,
    });

    const updated = await this.prisma.workItem.update({
      where: { id: input.id },
      data: {
        parentId:
          input.parentId === undefined ? existing.parentId : input.parentId,
        name: input.name ?? existing.name,
        type: input.type ?? existing.type,
        wbs: input.wbs ?? existing.wbs,
        order: input.order ?? existing.order,
        unit: input.unit ?? existing.unit,
        cod: input.cod ?? existing.cod,
        fonte: input.fonte ?? existing.fonte,
        ...derivedValues,
        updatedById: input.userId ?? null,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId!,
      userId: input.userId,
      projectId: existing.projectId,
      action: 'UPDATE',
      model: 'WorkItem',
      entityId: input.id,
      before: existing as Record<string, unknown>,
      after: updated as Record<string, unknown>,
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
          permissionCodes: [
            'wbs.view',
            'wbs.edit',
            'planning.view',
            'planning.edit',
          ],
          includeProjectMembers: true,
          metadata: {
            workItemId: updated.id,
            wbs: updated.wbs,
          },
        })
        .catch(() => undefined);
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

    void this.auditService.log({
      instanceId,
      userId,
      projectId: target.projectId,
      action: 'DELETE',
      model: 'WorkItem',
      entityId: id,
      before: target as Record<string, unknown>,
      metadata: { deletedIds: ids },
    });

    return { deleted: ids.length };
  }

  async recalculateProject(
    projectId: string,
    instanceId: string,
    userId?: string,
    scope = 'wbs',
  ): Promise<{ updated: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);

    const items = await this.prisma.workItem.findMany({
      where: {
        projectId,
        scope: scope === 'wbs' ? 'wbs' : { not: 'quantitativo' },
      },
      orderBy: { order: 'asc' },
    });

    if (items.length === 0) {
      return { updated: 0 };
    }

    type MutableNode = (typeof items)[number] & { children: MutableNode[] };
    const itemMap = new Map<string, MutableNode>();
    const roots: MutableNode[] = [];

    for (const item of items) {
      itemMap.set(item.id, { ...item, children: [] });
    }

    for (const item of items) {
      const node = itemMap.get(item.id)!;
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortNodes = (nodes: MutableNode[]) => {
      nodes.sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const child of nodes) {
        if (child.children.length > 0) {
          sortNodes(child.children);
        }
      }
    };
    sortNodes(roots);

    const recalcNode = (node: MutableNode) => {
      for (const child of node.children) {
        recalcNode(child);
      }

      if (node.type === 'category') {
        node.contractTotal = this.sumFromChildren(node.children, 'contractTotal');
        node.previousTotal = this.sumFromChildren(node.children, 'previousTotal');
        node.currentTotal = this.sumFromChildren(node.children, 'currentTotal');
        node.accumulatedTotal = this.truncate2(
          node.previousTotal + node.currentTotal,
        );
        node.balanceTotal = this.truncate2(
          node.contractTotal - node.accumulatedTotal,
        );
        node.accumulatedPercentage =
          node.contractTotal > 0
            ? this.round2((node.accumulatedTotal / node.contractTotal) * 100)
            : 0;
        return;
      }

      const derivedValues = this.withDerivedValues({
        type: node.type,
        contractQuantity: node.contractQuantity,
        unitPrice: node.unitPrice,
        unitPriceNoBdi: node.unitPriceNoBdi,
        contractTotal: node.contractTotal,
        previousQuantity: node.previousQuantity,
        previousTotal: node.previousTotal,
        currentQuantity: node.currentQuantity,
        currentTotal: node.currentTotal,
        currentPercentage: node.currentPercentage,
        accumulatedQuantity: node.accumulatedQuantity,
        accumulatedTotal: node.accumulatedTotal,
        accumulatedPercentage: node.accumulatedPercentage,
        balanceQuantity: node.balanceQuantity,
        balanceTotal: node.balanceTotal,
      });
      node.contractQuantity = derivedValues.contractQuantity;
      node.unitPrice = derivedValues.unitPrice;
      node.unitPriceNoBdi = derivedValues.unitPriceNoBdi;
      node.contractTotal = derivedValues.contractTotal;
      node.previousQuantity = derivedValues.previousQuantity;
      node.previousTotal = derivedValues.previousTotal;
      node.currentQuantity = derivedValues.currentQuantity;
      node.currentTotal = derivedValues.currentTotal;
      node.currentPercentage = derivedValues.currentPercentage;
      node.accumulatedQuantity = derivedValues.accumulatedQuantity;
      node.accumulatedTotal = derivedValues.accumulatedTotal;
      node.accumulatedPercentage = derivedValues.accumulatedPercentage;
      node.balanceQuantity = derivedValues.balanceQuantity;
      node.balanceTotal = derivedValues.balanceTotal;
    };

    for (const root of roots) {
      recalcNode(root);
    }

    const recalculated = Array.from(itemMap.values());
    const txOps = recalculated.map((item) =>
      this.prisma.workItem.update({
        where: { id: item.id },
        data: {
          contractQuantity: item.contractQuantity,
          unitPrice: item.unitPrice,
          unitPriceNoBdi: item.unitPriceNoBdi,
          contractTotal: item.contractTotal,
          previousQuantity: item.previousQuantity,
          previousTotal: item.previousTotal,
          currentQuantity: item.currentQuantity,
          currentTotal: item.currentTotal,
          currentPercentage: item.currentPercentage,
          accumulatedQuantity: item.accumulatedQuantity,
          accumulatedTotal: item.accumulatedTotal,
          accumulatedPercentage: item.accumulatedPercentage,
          balanceQuantity: item.balanceQuantity,
          balanceTotal: item.balanceTotal,
          updatedById: userId ?? null,
        },
      }),
    );

    const chunks = this.chunkItems(txOps, 50);
    for (const chunk of chunks) {
      await this.prisma.$transaction(chunk);
    }

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'UPDATE',
      model: 'WorkItem',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: 'recalculateProject',
        scope,
        count: recalculated.length,
      },
    });

    return { updated: recalculated.length };
  }
}
