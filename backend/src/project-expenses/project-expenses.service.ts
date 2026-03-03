import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isLocalUpload, removeLocalUpload } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

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
  paymentProof?: string | null;
  invoiceDoc?: string | null;
  deliveryDate?: string;
  discountValue?: number;
  discountPercentage?: number;
  issValue?: number;
  issPercentage?: number;
  linkedWorkItemId?: string;
  supplierId?: string | null;
  contractorId?: string | null;
}

interface UpdateExpenseInput extends Partial<CreateExpenseInput> {
  id: string;
  userId?: string;
}

interface MaterialSuggestionInput {
  projectId: string;
  query: string;
  limit: number;
  supplierId?: string;
  instanceId: string;
  userId?: string;
  permissions: string[];
}

type MaterialSuggestion = {
  label: string;
  normalizedLabel: string;
  calculationMemory?: string;
  unit?: string;
  lastUnitPrice?: number;
  supplierId?: string;
  supplierName?: string;
  usageCount: number;
  lastDate?: string;
  source: 'forecast' | 'expense' | 'mixed';
};

@Injectable()
export class ProjectExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private async canRemoveUpload(url?: string | null) {
    if (!isLocalUpload(url)) return false;

    const [
      forecastPayment,
      expensePayment,
      expenseInvoice,
      groupPayment,
      groupInvoice,
    ] = await Promise.all([
      this.prisma.materialForecast.count({ where: { paymentProof: url } }),
      this.prisma.projectExpense.count({ where: { paymentProof: url } }),
      this.prisma.projectExpense.count({ where: { invoiceDoc: url } }),
      this.prisma.supplyGroup.count({ where: { paymentProof: url } }),
      this.prisma.supplyGroup.count({ where: { invoiceDoc: url } }),
    ]);

    return (
      forecastPayment +
        expensePayment +
        expenseInvoice +
        groupPayment +
        groupInvoice ===
      0
    );
  }

  private async cleanupUploadsIfOrphaned(
    urls: Array<string | null | undefined>,
  ) {
    const unique = Array.from(new Set(urls.filter(Boolean))) as string[];
    for (const url of unique) {
      if (await this.canRemoveUpload(url)) {
        await removeLocalUpload(url);
      }
    }
  }

  private async emitExpenseStatusNotification(
    instanceId: string,
    expense: {
      id: string;
      projectId: string;
      status: ExpenseStatus;
      description: string;
      amount: number;
      entityName: string;
    },
    actorUserId?: string,
  ) {
    const forecastById = await this.prisma.materialForecast.findFirst({
      where: {
        id: expense.id,
        projectPlanning: { projectId: expense.projectId },
      },
      select: {
        id: true,
        supplyGroupId: true,
        supplyGroup: { select: { id: true, title: true } },
      },
    });

    const materialDescription = this.extractExpenseMaterialDescription(
      expense.description,
    );

    const forecastByDescription = forecastById
      ? null
      : await this.prisma.materialForecast.findFirst({
          where: {
            projectPlanning: { projectId: expense.projectId },
            description: { equals: materialDescription, mode: 'insensitive' },
          },
          select: {
            id: true,
            supplyGroupId: true,
            supplyGroup: { select: { id: true, title: true } },
          },
          orderBy: [{ supplyGroupId: 'desc' }, { order: 'asc' }],
        });

    const forecastContext = forecastById ?? forecastByDescription;

    const supplyGroupId = forecastContext?.supplyGroupId ?? null;
    const supplyGroupLabel =
      forecastContext?.supplyGroup?.title?.trim() ||
      (supplyGroupId ? `Lote ${supplyGroupId.slice(0, 8)}` : null);

    if (expense.status === 'PAID') {
      await this.notificationsService.emit({
        instanceId,
        projectId: expense.projectId,
        actorUserId,
        category: 'FINANCIAL',
        eventType: 'EXPENSE_PAID',
        priority: 'high',
        title: supplyGroupId
          ? 'Liquidação Financeira do Lote'
          : 'Liquidação Financeira',
        body: supplyGroupId
          ? `Pagamento confirmado para ${supplyGroupLabel}. Valor total deste item: R$ ${expense.amount.toFixed(2)}. Credor: ${expense.entityName || 'Não informado'}.`
          : `Pagamento confirmado para ${expense.description}. Valor: R$ ${expense.amount.toFixed(2)}. Credor: ${expense.entityName || 'Não informado'}.`,
        dedupeKey: supplyGroupId
          ? `supply-group:${supplyGroupId}:PAID`
          : `expense:${expense.id}:PAID`,
        permissionCodes: ['supplies.view', 'supplies.edit'],
        includeProjectMembers: true,
        metadata: {
          expenseId: expense.id,
          status: expense.status,
          supplyGroupId,
        },
      });
      return;
    }

    if (expense.status === 'DELIVERED') {
      await this.notificationsService.emit({
        instanceId,
        projectId: expense.projectId,
        actorUserId,
        category: 'SUPPLIES',
        eventType: 'EXPENSE_DELIVERED',
        priority: 'normal',
        title: supplyGroupId
          ? 'Recebimento de Lote de Material'
          : 'Recebimento de Material',
        body: supplyGroupId
          ? `Entrega do ${supplyGroupLabel} confirmada no canteiro.`
          : `Entrega confirmada no canteiro: ${expense.description}.`,
        dedupeKey: supplyGroupId
          ? `supply-group:${supplyGroupId}:DELIVERED`
          : `expense:${expense.id}:DELIVERED`,
        permissionCodes: ['supplies.view', 'supplies.edit'],
        includeProjectMembers: true,
        metadata: {
          expenseId: expense.id,
          status: expense.status,
          supplyGroupId,
        },
      });
    }
  }

  private normalizeText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private extractExpenseMaterialDescription(description: string) {
    const parts = description.split(':');
    if (parts.length <= 1) return description.trim();
    return parts.slice(1).join(':').trim() || description.trim();
  }

  private parseDate(value?: string) {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
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
    return this.prisma.projectExpense.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async getMaterialSuggestions(
    input: MaterialSuggestionInput,
  ): Promise<MaterialSuggestion[]> {
    const query = input.query?.trim();
    if (!query || query.length < 2) return [];

    await this.ensureProject(input.projectId, input.instanceId, input.userId);

    const currentProject = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, instanceId: true },
    });

    if (!currentProject) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const targetInstanceId = currentProject.instanceId;

    const hasGeneralProjectAccess =
      input.permissions.includes('projects_general.view') ||
      input.permissions.includes('projects_general.edit');

    const isNativeToTargetInstance = input.instanceId === targetInstanceId;

    const scopedProjectIds = new Set<string>([input.projectId]);

    if (hasGeneralProjectAccess && isNativeToTargetInstance) {
      const projects = await this.prisma.project.findMany({
        where: { instanceId: targetInstanceId },
        select: { id: true },
      });
      projects.forEach((project) => scopedProjectIds.add(project.id));
    }

    if (input.userId) {
      const memberships = await this.prisma.projectMember.findMany({
        where: {
          userId: input.userId,
          project: { instanceId: targetInstanceId },
        },
        select: { projectId: true },
      });
      memberships.forEach((membership) =>
        scopedProjectIds.add(membership.projectId),
      );
    }

    const projectIds = Array.from(scopedProjectIds);

    const supplierNameFilter = input.supplierId
      ? (
          await this.prisma.supplier.findUnique({
            where: { id: input.supplierId },
            select: { name: true },
          })
        )?.name
      : undefined;

    const [expenses, forecasts] = await Promise.all([
      this.prisma.projectExpense.findMany({
        where: {
          projectId: { in: projectIds },
          type: 'material',
          itemType: 'item',
          description: { contains: query, mode: 'insensitive' },
          ...(supplierNameFilter
            ? {
                entityName: {
                  contains: supplierNameFilter,
                  mode: 'insensitive',
                },
              }
            : {}),
        },
        select: {
          description: true,
          unit: true,
          unitPrice: true,
          entityName: true,
          date: true,
        },
        orderBy: { date: 'desc' },
        take: 400,
      }),
      this.prisma.materialForecast.findMany({
        where: {
          projectPlanning: { projectId: { in: projectIds } },
          description: { contains: query, mode: 'insensitive' },
          ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        },
        select: {
          description: true,
          calculationMemory: true,
          unit: true,
          unitPrice: true,
          supplierId: true,
          estimatedDate: true,
          purchaseDate: true,
          deliveryDate: true,
          supplier: { select: { name: true } },
        },
        orderBy: { estimatedDate: 'desc' },
        take: 400,
      }),
    ]);

    const normalizedQuery = this.normalizeText(query);
    const bucket = new Map<string, MaterialSuggestion>();

    for (const forecast of forecasts) {
      const label = forecast.description?.trim();
      if (!label) continue;
      const normalizedLabel = this.normalizeText(label);
      if (!normalizedLabel.includes(normalizedQuery)) continue;

      const date =
        forecast.deliveryDate ||
        forecast.purchaseDate ||
        forecast.estimatedDate;
      const existing = bucket.get(normalizedLabel);

      if (!existing) {
        bucket.set(normalizedLabel, {
          label,
          normalizedLabel,
          calculationMemory: forecast.calculationMemory || undefined,
          unit: forecast.unit || undefined,
          lastUnitPrice: forecast.unitPrice || 0,
          supplierId: forecast.supplierId || undefined,
          supplierName: forecast.supplier?.name || undefined,
          usageCount: 1,
          lastDate: date,
          source: 'forecast',
        });
        continue;
      }

      const existingDate = this.parseDate(existing.lastDate);
      const nextDate = this.parseDate(date);
      bucket.set(normalizedLabel, {
        ...existing,
        usageCount: existing.usageCount + 1,
        calculationMemory:
          nextDate >= existingDate
            ? forecast.calculationMemory || existing.calculationMemory
            : existing.calculationMemory ||
              forecast.calculationMemory ||
              undefined,
        unit: existing.unit || forecast.unit || undefined,
        lastUnitPrice:
          nextDate >= existingDate
            ? forecast.unitPrice
            : existing.lastUnitPrice,
        supplierId: existing.supplierId || forecast.supplierId || undefined,
        supplierName:
          existing.supplierName || forecast.supplier?.name || undefined,
        lastDate: nextDate >= existingDate ? date : existing.lastDate,
        source: existing.source === 'expense' ? 'mixed' : 'forecast',
      });
    }

    for (const expense of expenses) {
      const label = this.extractExpenseMaterialDescription(
        expense.description || '',
      );
      if (!label) continue;
      const normalizedLabel = this.normalizeText(label);
      if (!normalizedLabel.includes(normalizedQuery)) continue;

      const existing = bucket.get(normalizedLabel);
      if (!existing) {
        bucket.set(normalizedLabel, {
          label,
          normalizedLabel,
          unit: expense.unit || undefined,
          lastUnitPrice: expense.unitPrice || 0,
          supplierName: expense.entityName || undefined,
          usageCount: 1,
          lastDate: expense.date,
          source: 'expense',
        });
        continue;
      }

      const existingDate = this.parseDate(existing.lastDate);
      const nextDate = this.parseDate(expense.date);
      bucket.set(normalizedLabel, {
        ...existing,
        usageCount: existing.usageCount + 1,
        unit: existing.unit || expense.unit || undefined,
        lastUnitPrice:
          nextDate >= existingDate ? expense.unitPrice : existing.lastUnitPrice,
        supplierName: existing.supplierName || expense.entityName || undefined,
        lastDate: nextDate >= existingDate ? expense.date : existing.lastDate,
        source: existing.source === 'forecast' ? 'mixed' : 'expense',
      });
    }

    return Array.from(bucket.values())
      .sort((a, b) => {
        const aStarts = a.normalizedLabel.startsWith(normalizedQuery) ? 1 : 0;
        const bStarts = b.normalizedLabel.startsWith(normalizedQuery) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        return this.parseDate(b.lastDate) - this.parseDate(a.lastDate);
      })
      .slice(0, Math.max(1, Math.min(input.limit || 8, 20)));
  }

  async create(input: CreateExpenseInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const fallbackStatus: ExpenseStatus = input.isPaid ? 'PAID' : 'PENDING';

    const created = await this.prisma.projectExpense.create({
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
        supplierId: input.supplierId || null,
        contractorId: input.contractorId || null,
        createdById: input.userId ?? null,
      },
    });

    this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'ProjectExpense',
      entityId: created.id,
      after: created,
    });

    if (created.status === 'PAID' || created.status === 'DELIVERED') {
      void this.emitExpenseStatusNotification(
        input.instanceId,
        {
          id: created.id,
          projectId: created.projectId,
          status: created.status,
          description: created.description,
          amount: created.amount,
          entityName: created.entityName,
        },
        input.userId,
      ).catch(() => undefined);
    }

    return created;
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

    await ensureProjectWritable(this.prisma, existing.projectId);

    // Guard: if this expense is synced from a MaterialForecast (same ID),
    // block editing forecast-controlled fields — only allow expense-exclusive fields
    const linkedForecast = await this.prisma.materialForecast.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    const linkedLaborPayment = await this.prisma.laborPayment.findUnique({
      where: { id: input.id },
      select: {
        id: true,
        data: true,
        comprovante: true,
        laborContract: { select: { projectId: true } },
      },
    });
    if (linkedForecast) {
      // Strip forecast-synced fields to prevent manual overwrites
      delete input.description;
      delete input.entityName;
      delete input.unit;
      delete input.quantity;
      delete input.unitPrice;
      delete input.discountValue;
      delete input.discountPercentage;
      delete input.amount;
      delete input.isPaid;
      delete input.status;
      delete input.paymentDate;
      delete input.date;
      delete input.deliveryDate;
      delete input.type;
      delete input.itemType;
      // paymentProof and invoiceDoc are editable from both sides
    }
    if (linkedLaborPayment) {
      // Strip labor-synced fields to prevent manual overwrites from Financeiro
      delete input.type;
      delete input.itemType;
      delete input.date;
      delete input.description;
      delete input.entityName;
      delete input.unit;
      delete input.quantity;
      delete input.unitPrice;
      delete input.amount;
      delete input.isPaid;
      delete input.status;
      delete input.paymentDate;
      delete input.linkedWorkItemId;
      delete input.contractorId;
    }

    const nextStatus = input.status ?? existing.status;
    const hasPaymentProof = Object.prototype.hasOwnProperty.call(
      input,
      'paymentProof',
    );
    const hasInvoiceDoc = Object.prototype.hasOwnProperty.call(
      input,
      'invoiceDoc',
    );
    const previousPaymentProof = existing.paymentProof;
    const previousInvoiceDoc = existing.invoiceDoc;

    const updated = await this.prisma.projectExpense.update({
      where: { id: input.id },
      data: {
        parentId:
          input.parentId === undefined ? existing.parentId : input.parentId,
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
        paymentProof: hasPaymentProof
          ? input.paymentProof || null
          : existing.paymentProof,
        invoiceDoc: hasInvoiceDoc ? input.invoiceDoc || null : existing.invoiceDoc,
        deliveryDate: input.deliveryDate ?? existing.deliveryDate,
        discountValue: input.discountValue ?? existing.discountValue,
        discountPercentage:
          input.discountPercentage ?? existing.discountPercentage,
        issValue: input.issValue ?? existing.issValue,
        issPercentage: input.issPercentage ?? existing.issPercentage,
        linkedWorkItemId: input.linkedWorkItemId ?? existing.linkedWorkItemId,
        supplierId: input.supplierId !== undefined ? (input.supplierId || null) : existing.supplierId,
        contractorId: input.contractorId !== undefined ? (input.contractorId || null) : existing.contractorId,
        updatedById: input.userId ?? null,
      },
    });

    if (input.instanceId) {
      this.auditService.log({
        instanceId: input.instanceId,
        userId: input.userId,
        projectId: updated.projectId,
        action: 'UPDATE',
        model: 'ProjectExpense',
        entityId: updated.id,
        before: existing,
        after: updated,
      });
    }

    if (
      input.instanceId &&
      existing.status !== nextStatus &&
      (nextStatus === 'PAID' || nextStatus === 'DELIVERED')
    ) {
      void this.emitExpenseStatusNotification(
        input.instanceId,
        {
          id: updated.id,
          projectId: updated.projectId,
          status: updated.status,
          description: updated.description,
          amount: updated.amount,
          entityName: updated.entityName,
        },
        input.userId,
      ).catch(() => undefined);
    }

    if (linkedLaborPayment && hasPaymentProof) {
      const laborPaymentBefore = {
        id: linkedLaborPayment.id,
        data: linkedLaborPayment.data,
        comprovante: linkedLaborPayment.comprovante,
      };

      const laborPaymentUpdated = await this.prisma.laborPayment.update({
        where: { id: linkedLaborPayment.id },
        data: {
          data: linkedLaborPayment.data,
          comprovante: hasPaymentProof
            ? input.paymentProof || null
            : linkedLaborPayment.comprovante,
        },
        select: {
          id: true,
          data: true,
          comprovante: true,
        },
      });

      if (input.instanceId) {
        void this.auditService.log({
          instanceId: input.instanceId,
          userId: input.userId,
          projectId: linkedLaborPayment.laborContract.projectId,
          action: 'UPDATE',
          model: 'LaborPayment',
          entityId: linkedLaborPayment.id,
          before: laborPaymentBefore as Record<string, unknown>,
          after: laborPaymentUpdated as Record<string, unknown>,
          metadata: {
            operation: 'syncFromProjectExpense',
          } as Record<string, unknown>,
        });
      }
    }

    await this.cleanupUploadsIfOrphaned([
      hasPaymentProof ? previousPaymentProof : null,
      hasInvoiceDoc ? previousInvoiceDoc : null,
    ]);

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

  async batchInsert(
    projectId: string,
    expenses: Array<Omit<CreateExpenseInput, 'instanceId'>>,
    replaceTypes: string[] | null,
    instanceId: string,
    userId?: string,
  ): Promise<{ created: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);

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
      supplierId: e.supplierId || null,
      contractorId: e.contractorId || null,
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

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'CREATE',
      model: 'ProjectExpense',
      entityId: projectId,
      metadata: {
        batch: true,
        operation: replaceTypes?.length ? 'batchInsertReplace' : 'batchInsert',
        count: expenses.length,
        replaceTypes: replaceTypes || undefined,
      },
    });

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

    await ensureProjectWritable(this.prisma, target.projectId);

    const allItems = await this.prisma.projectExpense.findMany({
      where: { projectId: target.projectId },
      select: { id: true, parentId: true },
    });

    const ids = this.collectDescendants(allItems, id);

    // Block deletion if ANY descendant (or the item itself) is forecast-linked
    const linkedForecasts = await this.prisma.materialForecast.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (linkedForecasts.length > 0) {
      throw new ForbiddenException(
        `Não é possível excluir: ${linkedForecasts.length === 1 ? 'existe 1 item' : `existem ${linkedForecasts.length} itens`} controlado(s) por Compras nesta hierarquia. Remova-os primeiro em Compras.`,
      );
    }

    const linkedLaborPayments = await this.prisma.laborPayment.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (linkedLaborPayments.length > 0) {
      throw new ForbiddenException(
        `Não é possível excluir: ${linkedLaborPayments.length === 1 ? 'existe 1 item' : `existem ${linkedLaborPayments.length} itens`} controlado(s) por Mão de Obra nesta hierarquia. Remova-os primeiro em Mão de Obra.`,
      );
    }

    const attachments = await this.prisma.projectExpense.findMany({
      where: { id: { in: ids } },
      select: { paymentProof: true, invoiceDoc: true },
    });

    const candidateUploads = attachments.flatMap((item) => [
      item.paymentProof,
      item.invoiceDoc,
    ]);

    await this.prisma.projectExpense.deleteMany({
      where: { id: { in: ids } },
    });

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    this.auditService.log({
      instanceId,
      userId,
      projectId: target.projectId,
      action: 'DELETE',
      model: 'ProjectExpense',
      entityId: id,
      metadata: { deletedIds: ids },
    });

    return { deleted: ids.length };
  }
}
