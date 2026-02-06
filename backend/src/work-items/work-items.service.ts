import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateWorkItemInput {
  id?: string;
  projectId: string;
  instanceId: string;
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

interface UpdateWorkItemInput extends Partial<CreateWorkItemInput> {
  id: string;
}

@Injectable()
export class WorkItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
  }

  async findAll(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    return this.prisma.workItem.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateWorkItemInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    return this.prisma.workItem.create({
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
  }

  async update(input: UpdateWorkItemInput) {
    const existing = await this.prisma.workItem.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });
    if (!existing) throw new NotFoundException('Item nao encontrado');

    return this.prisma.workItem.update({
      where: { id: input.id },
      data: {
        parentId: input.parentId ?? existing.parentId,
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

  async remove(id: string, instanceId: string) {
    const target = await this.prisma.workItem.findFirst({
      where: { id, project: { instanceId } },
      select: { id: true, projectId: true },
    });

    if (!target) throw new NotFoundException('Item nao encontrado');

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
