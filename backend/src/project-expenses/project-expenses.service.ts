import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateExpenseInput {
  projectId: string;
  instanceId: string;
  parentId?: string | null;
  type: string;
  itemType: string;
  wbs?: string;
  order?: number;
  date: string;
  description: string;
  entityName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  isPaid?: boolean;
  status?: string;
  paymentDate?: string;
  paymentProof?: string;
  invoiceDoc?: string;
  deliveryDate?: string;
  discountValue?: number;
  discountPercentage?: number;
  linkedWorkItemId?: string;
}

interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
  id: string;
}

@Injectable()
export class ProjectExpensesService {
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
    return this.prisma.projectExpense.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateExpenseInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    return this.prisma.projectExpense.create({
      data: {
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        type: input.type,
        itemType: input.itemType,
        wbs: input.wbs || '',
        order: input.order ?? 0,
        date: input.date,
        description: input.description,
        entityName: input.entityName,
        unit: input.unit,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        amount: input.amount,
        isPaid: input.isPaid ?? false,
        status: input.status || (input.isPaid ? 'PAID' : 'PENDING'),
        paymentDate: input.paymentDate || null,
        paymentProof: input.paymentProof || null,
        invoiceDoc: input.invoiceDoc || null,
        deliveryDate: input.deliveryDate || null,
        discountValue: input.discountValue ?? null,
        discountPercentage: input.discountPercentage ?? null,
        linkedWorkItemId: input.linkedWorkItemId || null,
      },
    });
  }

  async update(input: UpdateExpenseInput) {
    const existing = await this.prisma.projectExpense.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });

    if (!existing) throw new NotFoundException('Despesa nao encontrada');

    return this.prisma.projectExpense.update({
      where: { id: input.id },
      data: {
        parentId: input.parentId ?? existing.parentId,
        type: input.type ?? existing.type,
        itemType: input.itemType ?? existing.itemType,
        wbs: input.wbs ?? existing.wbs,
        order: input.order ?? existing.order,
        date: input.date ?? existing.date,
        description: input.description ?? existing.description,
        entityName: input.entityName ?? existing.entityName,
        unit: input.unit ?? existing.unit,
        quantity: input.quantity ?? existing.quantity,
        unitPrice: input.unitPrice ?? existing.unitPrice,
        amount: input.amount ?? existing.amount,
        isPaid: input.isPaid ?? existing.isPaid,
        status: input.status ?? existing.status,
        paymentDate: input.paymentDate ?? existing.paymentDate,
        paymentProof: input.paymentProof ?? existing.paymentProof,
        invoiceDoc: input.invoiceDoc ?? existing.invoiceDoc,
        deliveryDate: input.deliveryDate ?? existing.deliveryDate,
        discountValue: input.discountValue ?? existing.discountValue,
        discountPercentage: input.discountPercentage ?? existing.discountPercentage,
        linkedWorkItemId: input.linkedWorkItemId ?? existing.linkedWorkItemId,
      },
    });
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

  async remove(id: string, instanceId: string) {
    const target = await this.prisma.projectExpense.findFirst({
      where: { id, project: { instanceId } },
      select: { id: true, projectId: true },
    });

    if (!target) throw new NotFoundException('Despesa nao encontrada');

    const allItems = await this.prisma.projectExpense.findMany({
      where: { projectId: target.projectId },
      select: { id: true, parentId: true },
    });

    const ids = this.collectDescendants(allItems, id);

    await this.prisma.projectExpense.deleteMany({
      where: { id: { in: ids } },
    });

    return { deleted: ids.length };
  }
}
