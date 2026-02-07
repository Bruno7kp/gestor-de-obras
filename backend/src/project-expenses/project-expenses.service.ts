import { Injectable, NotFoundException } from '@nestjs/common';
import type { ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';
import { ensureProjectAccess } from '../common/project-access.util';

interface CreateExpenseInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
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
  status?: ExpenseStatus;
  paymentDate?: string;
  paymentProof?: string;
  invoiceDoc?: string;
  deliveryDate?: string;
  discountValue?: number;
  discountPercentage?: number;
  issValue?: number;
  issPercentage?: number;
  linkedWorkItemId?: string;
}

interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class ProjectExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    return ensureProjectAccess(this.prisma, projectId, instanceId, userId);
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.projectExpense.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateExpenseInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const fallbackStatus: ExpenseStatus = input.isPaid ? 'PAID' : 'PENDING';

    return this.prisma.projectExpense.create({
      data: {
        id: input.id,
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
        status: input.status ?? fallbackStatus,
        paymentDate: input.paymentDate || null,
        paymentProof: input.paymentProof || null,
        invoiceDoc: input.invoiceDoc || null,
        deliveryDate: input.deliveryDate || null,
        discountValue: input.discountValue ?? null,
        discountPercentage: input.discountPercentage ?? null,
        issValue: input.issValue ?? null,
        issPercentage: input.issPercentage ?? null,
        linkedWorkItemId: input.linkedWorkItemId || null,
      },
    });
  }

  async update(input: UpdateExpenseInput) {
    let existing = await this.prisma.projectExpense.findFirst({
      where: {
        id: input.id,
        project: { instanceId: input.instanceId },
      },
    });

    if (!existing && input.userId) {
      const expense = await this.prisma.projectExpense.findFirst({
        where: { id: input.id },
        include: { project: { select: { id: true } } },
      });
      if (expense) {
        const membership = await this.prisma.projectMember.findFirst({
          where: { projectId: expense.project.id, user: { id: input.userId } },
        });
        if (membership) existing = expense;
      }
    }

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
        discountPercentage:
          input.discountPercentage ?? existing.discountPercentage,
        issValue: input.issValue ?? existing.issValue,
        issPercentage: input.issPercentage ?? existing.issPercentage,
        linkedWorkItemId: input.linkedWorkItemId ?? existing.linkedWorkItemId,
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

  async batchInsert(
    projectId: string,
    expenses: Array<Omit<CreateExpenseInput, 'instanceId'>>,
    replaceTypes: string[] | null,
    instanceId: string,
    userId?: string,
  ): Promise<{ created: number }> {
    await this.ensureProject(projectId, instanceId, userId);

    const createData = expenses.map((e) => ({
      id: e.id,
      projectId,
      parentId: e.parentId ?? null,
      type: e.type,
      itemType: e.itemType,
      wbs: e.wbs ?? '',
      order: e.order ?? 0,
      date: e.date,
      description: e.description,
      entityName: e.entityName,
      unit: e.unit,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      amount: e.amount,
      isPaid: e.isPaid ?? false,
      status: e.status ?? (e.isPaid ? 'PAID' : 'PENDING'),
      paymentDate: e.paymentDate || null,
      paymentProof: e.paymentProof || null,
      invoiceDoc: e.invoiceDoc || null,
      deliveryDate: e.deliveryDate || null,
      discountValue: e.discountValue ?? null,
      discountPercentage: e.discountPercentage ?? null,
      issValue: e.issValue ?? null,
      issPercentage: e.issPercentage ?? null,
      linkedWorkItemId: e.linkedWorkItemId || null,
    }));

    if (replaceTypes && replaceTypes.length > 0) {
      // delete only the specified types
      await this.prisma.$transaction([
        this.prisma.projectExpense.deleteMany({
          where: {
            projectId,
            type: { in: replaceTypes },
          },
        }),
        this.prisma.projectExpense.createMany({ data: createData }),
      ]);
    } else {
      await this.prisma.projectExpense.createMany({ data: createData });
    }

    return { created: expenses.length };
  }

  async remove(id: string, instanceId: string, userId?: string) {
    let target = await this.prisma.projectExpense.findFirst({
      where: { id, project: { instanceId } },
      select: { id: true, projectId: true },
    });

    if (!target && userId) {
      const expense = await this.prisma.projectExpense.findFirst({
        where: { id },
        select: { id: true, projectId: true },
      });
      if (expense) {
        const membership = await this.prisma.projectMember.findFirst({
          where: { projectId: expense.projectId, user: { id: userId } },
        });
        if (membership) target = expense;
      }
    }

    if (!target) throw new NotFoundException('Despesa nao encontrada');

    const allItems = await this.prisma.projectExpense.findMany({
      where: { projectId: target.projectId },
      select: { id: true, parentId: true },
    });

    const ids = this.collectDescendants(allItems, id);

    const attachments = await this.prisma.projectExpense.findMany({
      where: { id: { in: ids } },
      select: { paymentProof: true, invoiceDoc: true },
    });

    await removeLocalUploads(
      attachments.flatMap((item) => [item.paymentProof, item.invoiceDoc]),
    );

    await this.prisma.projectExpense.deleteMany({
      where: { id: { in: ids } },
    });

    return { deleted: ids.length };
  }
}
