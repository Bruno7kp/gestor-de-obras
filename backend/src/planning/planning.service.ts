import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ExpenseStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isLocalUpload, removeLocalUpload } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

type TxClient = Prisma.TransactionClient;

interface CreateTaskInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  categoryId?: string | null;
  description: string;
  status: string;
  isCompleted: boolean;
  dueDate: string;
  createdAt: string;
  completedAt?: string | null;
}

interface CreateForecastInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  createdById?: string | null;
  categoryId?: string | null;
  description: string;
  calculationMemory?: string | null;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  order?: number;
  supplierId?: string | null;
  supplyGroupId?: string | null;
  paymentProof?: string | null;
}

interface SupplyGroupItemInput {
  id?: string;
  description: string;
  calculationMemory?: string | null;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  discountValue?: number;
  discountPercentage?: number;
  categoryId?: string | null;
  order?: number;
}

interface CreateSupplyGroupInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  title?: string | null;
  supplierId?: string | null;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  paymentProof?: string | null;
  invoiceDoc?: string | null;
  items: SupplyGroupItemInput[];
}

type UpdateSupplyGroupInput = Partial<
  Omit<CreateSupplyGroupInput, 'projectId' | 'instanceId' | 'userId' | 'items'>
>;

interface ConvertForecastsToGroupInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  forecastIds: string[];
  title?: string | null;
  supplierId?: string | null;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  isCleared: boolean;
  paymentProof?: string | null;
  invoiceDoc?: string | null;
}

interface CreateMilestoneInput {
  id?: string;
  projectId: string;
  instanceId: string;
  userId?: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private normalizeRelationId(value?: string | null): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async emitSupplyOrderedNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    supplyGroupId?: string | null;
    label: string;
    referenceId: string;
  }) {
    const dedupeKey = input.supplyGroupId
      ? `supply-group:${input.supplyGroupId}:ORDERED`
      : `supply:${input.referenceId}:ORDERED`;

    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'SUPPLIES',
      eventType: 'SUPPLY_ORDERED',
      priority: 'normal',
      title: input.supplyGroupId
        ? 'Compra de Lote Registrada'
        : 'Compra de Suprimento Registrada',
      body: input.supplyGroupId
        ? `O lote ${input.label} foi marcado como comprado.`
        : `${input.label} foi marcado como comprado.`,
      dedupeKey,
      permissionCodes: ['supplies.view', 'supplies.edit'],
      includeProjectMembers: true,
      metadata: {
        supplyGroupId: input.supplyGroupId ?? null,
        referenceId: input.referenceId,
      },
    });
  }

  private async emitSupplyPaymentNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    supplyGroupId?: string | null;
    label: string;
    referenceId: string;
  }) {
    const dedupeKey = input.supplyGroupId
      ? `supply-group:${input.supplyGroupId}:PAID`
      : `expense:${input.referenceId}:PAID`;

    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'FINANCIAL',
      eventType: 'EXPENSE_PAID',
      priority: 'high',
      title: input.supplyGroupId
        ? 'Pagamento de Lote Registrado'
        : 'Pagamento de Suprimento Registrado',
      body: input.supplyGroupId
        ? `O lote ${input.label} foi marcado como pago.`
        : `${input.label} foi marcado como pago.`,
      dedupeKey,
      permissionCodes: ['supplies.view', 'supplies.edit'],
      includeProjectMembers: true,
      metadata: {
        supplyGroupId: input.supplyGroupId ?? null,
        referenceId: input.referenceId,
      },
    });
  }

  private getTaskStatusLabel(status: string) {
    if (status === 'todo') return 'A Fazer';
    if (status === 'doing') return 'Em Andamento';
    if (status === 'done') return 'Concluído';
    return status;
  }

  private async emitTaskCreatedNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    taskId: string;
    description: string;
    status: string;
  }) {
    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'PLANNING',
      eventType: 'TASK_CREATED',
      priority: 'normal',
      title: 'Nova tarefa de planejamento',
      body: `${input.description} foi criada em ${this.getTaskStatusLabel(input.status)}.`,
      dedupeKey: `task:${input.taskId}:CREATED`,
      permissionCodes: ['planning.view', 'planning.edit'],
      includeProjectMembers: true,
      metadata: {
        taskId: input.taskId,
        description: input.description,
        status: input.status,
      },
    });
  }

  private async emitTaskStatusChangedNotification(input: {
    instanceId: string;
    projectId: string;
    actorUserId?: string;
    taskId: string;
    description: string;
    oldStatus: string;
    newStatus: string;
  }) {
    await this.notificationsService.emit({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      category: 'PLANNING',
      eventType: 'TASK_STATUS_CHANGED',
      priority: 'normal',
      title: 'Status de tarefa atualizado',
      body: `${input.description} mudou de ${this.getTaskStatusLabel(input.oldStatus)} para ${this.getTaskStatusLabel(input.newStatus)}.`,
      dedupeKey: `task:${input.taskId}:STATUS:${input.newStatus}`,
      permissionCodes: ['planning.view', 'planning.edit'],
      includeProjectMembers: true,
      metadata: {
        taskId: input.taskId,
        description: input.description,
        oldStatus: input.oldStatus,
        newStatus: input.newStatus,
      },
    });
  }

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

  // ──────────────────────────────────────────────────────────────
  // Expense sync helpers — atomic forecast ↔ expense consistency
  // ──────────────────────────────────────────────────────────────

  private getExpensePrefix(status: string, isPaid: boolean): string {
    if (status === 'delivered') return 'Pedido Entregue';
    if (isPaid) return 'Pedido Pago';
    return 'Pedido Pendente';
  }

  private getExpenseStatus(
    forecastStatus: string,
    isPaid: boolean,
  ): ExpenseStatus {
    if (forecastStatus === 'delivered') return ExpenseStatus.DELIVERED;
    if (isPaid) return ExpenseStatus.PAID;
    return ExpenseStatus.PENDING;
  }

  private computeExpenseAmount(
    qty: number,
    unitPrice: number,
    discountValue: number,
  ): number {
    return Math.max(
      0,
      Math.round((qty * unitPrice - discountValue) * 100) / 100,
    );
  }

  /**
   * Resolve projectId from a projectPlanningId.
   */
  private async resolveProjectId(
    tx: TxClient,
    projectPlanningId: string,
  ): Promise<string> {
    const planning = await tx.projectPlanning.findUnique({
      where: { id: projectPlanningId },
      select: { projectId: true },
    });
    if (!planning) throw new NotFoundException('Planejamento nao encontrado');
    return planning.projectId;
  }

  /**
   * Resolve supplier name from supplierId.
   */
  private async resolveSupplierName(
    tx: TxClient,
    supplierId?: string | null,
  ): Promise<string> {
    if (!supplierId) return '';
    const supplier = await tx.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true },
    });
    return supplier?.name ?? '';
  }

  /**
   * Build the expense data object from a forecast. Used for both create and update.
   */
  private buildExpenseDataFromForecast(
    forecast: {
      id: string;
      description: string;
      unit: string;
      quantityNeeded: number;
      unitPrice: number;
      discountValue?: number | null;
      discountPercentage?: number | null;
      status: string;
      isPaid: boolean;
      purchaseDate?: string | null;
      deliveryDate?: string | null;
      paymentProof?: string | null;
      categoryId?: string | null;
    },
    supplierName: string,
  ) {
    const prefix = this.getExpensePrefix(forecast.status, forecast.isPaid);
    const discountValue = forecast.discountValue ?? 0;
    const amount = this.computeExpenseAmount(
      forecast.quantityNeeded,
      forecast.unitPrice,
      discountValue,
    );
    const expenseStatus = this.getExpenseStatus(
      forecast.status,
      forecast.isPaid,
    );
    const effectiveDate =
      forecast.purchaseDate || new Date().toISOString().split('T')[0];

    return {
      parentId: forecast.categoryId ?? null,
      type: 'material' as const,
      itemType: 'item' as const,
      wbs: '',
      order: 0,
      date: effectiveDate,
      description: `${prefix}: ${forecast.description}`,
      entityName: supplierName,
      unit: forecast.unit,
      quantity: forecast.quantityNeeded,
      unitPrice: forecast.unitPrice,
      discountValue: discountValue,
      discountPercentage: forecast.discountPercentage ?? 0,
      amount,
      isPaid: forecast.isPaid,
      status: expenseStatus,
      paymentDate: forecast.isPaid ? effectiveDate : null,
      paymentProof: forecast.paymentProof ?? null,
      invoiceDoc: null as string | null,
      deliveryDate:
        forecast.status === 'delivered'
          ? forecast.deliveryDate || new Date().toISOString().split('T')[0]
          : null,
      linkedWorkItemId: null as string | null,
    };
  }

  /**
   * Sync a single forecast's corresponding ProjectExpense atomically.
   *
   * Rules:
   * - status pending/quoted → delete expense if it exists
   * - status ordered/delivered → upsert expense with forecast values
   *
   * MUST be called inside a $transaction (receives tx client).
   * Returns the synced expense or null.
   */
  private async syncExpenseForForecast(
    tx: TxClient,
    forecast: {
      id: string;
      description: string;
      unit: string;
      quantityNeeded: number;
      unitPrice: number;
      discountValue?: number | null;
      discountPercentage?: number | null;
      status: string;
      isPaid: boolean;
      purchaseDate?: string | null;
      deliveryDate?: string | null;
      paymentProof?: string | null;
      categoryId?: string | null;
      supplierId?: string | null;
      projectPlanningId: string;
    },
    projectId: string,
  ) {
    const shouldHaveExpense =
      forecast.status === 'ordered' || forecast.status === 'delivered';

    if (!shouldHaveExpense) {
      // Remove expense if it exists (forecast went back to pending or was never ordered)
      await tx.projectExpense.deleteMany({ where: { id: forecast.id } });
      return null;
    }

    const supplierName = await this.resolveSupplierName(
      tx,
      forecast.supplierId,
    );
    const data = this.buildExpenseDataFromForecast(forecast, supplierName);

    const existing = await tx.projectExpense.findUnique({
      where: { id: forecast.id },
    });

    if (existing) {
      // Preserve expense-exclusive fields that don't come from forecast
      const updated = await tx.projectExpense.update({
        where: { id: forecast.id },
        data: {
          parentId: data.parentId ?? existing.parentId,
          date: data.date,
          description: data.description,
          entityName: data.entityName || existing.entityName,
          unit: data.unit,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          discountValue: data.discountValue,
          discountPercentage: data.discountPercentage,
          amount: data.amount,
          isPaid: data.isPaid,
          status: data.status,
          paymentDate: data.paymentDate ?? existing.paymentDate,
          paymentProof: data.paymentProof ?? existing.paymentProof,
          deliveryDate: data.deliveryDate ?? existing.deliveryDate,
          // Preserve expense-exclusive fields:
          // invoiceDoc, linkedWorkItemId, wbs, order, issValue, issPercentage
        },
      });
      return updated;
    }

    // Create new expense with same ID as forecast
    const created = await tx.projectExpense.create({
      data: {
        id: forecast.id,
        projectId,
        ...data,
      },
    });
    return created;
  }

  /**
   * Sync expenses for multiple forecasts (e.g., all in a supply group).
   */
  private async syncExpensesForForecasts(
    tx: TxClient,
    forecasts: Array<{
      id: string;
      description: string;
      unit: string;
      quantityNeeded: number;
      unitPrice: number;
      discountValue?: number | null;
      discountPercentage?: number | null;
      status: string;
      isPaid: boolean;
      purchaseDate?: string | null;
      deliveryDate?: string | null;
      paymentProof?: string | null;
      categoryId?: string | null;
      supplierId?: string | null;
      projectPlanningId: string;
    }>,
    projectId: string,
  ) {
    const results: Array<{
      id: string;
      expense: Record<string, unknown> | null;
    }> = [];
    for (const forecast of forecasts) {
      const expense = await this.syncExpenseForForecast(
        tx,
        forecast,
        projectId,
      );
      results.push({ id: forecast.id, expense });
    }
    return results;
  }

  /**
   * Delete expenses corresponding to forecast IDs (used when forecasts are deleted).
   */
  private async deleteExpensesForForecasts(
    tx: TxClient,
    forecastIds: string[],
  ) {
    if (forecastIds.length === 0) return;
    await tx.projectExpense.deleteMany({
      where: { id: { in: forecastIds } },
    });
  }

  // ──────────────────────────────────────────────────────────────

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

  private async ensurePlanningWritable(projectPlanningId: string) {
    const planning = await this.prisma.projectPlanning.findUnique({
      where: { id: projectPlanningId },
      select: { projectId: true },
    });

    if (!planning) {
      throw new NotFoundException('Planejamento nao encontrado');
    }

    await ensureProjectWritable(this.prisma, planning.projectId);
  }

  private async ensurePlanning(projectId: string) {
    const existing = await this.prisma.projectPlanning.findFirst({
      where: { projectId },
    });

    if (existing) return existing;

    return this.prisma.projectPlanning.create({
      data: {
        projectId,
        schedule: {},
      },
    });
  }

  private get taskInclude() {
    return {
      createdBy: { select: { id: true, name: true, profileImage: true } },
    } as const;
  }

  async listTasks(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.planningTask.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { createdAt: 'desc' },
      include: this.taskInclude,
    });
  }

  async createTask(input: CreateTaskInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const planning = await this.ensurePlanning(input.projectId);

    const createdTask = await this.prisma.planningTask.create({
      data: {
        id: input.id,
        projectPlanningId: planning.id,
        categoryId: input.categoryId ?? null,
        description: input.description,
        status: input.status,
        isCompleted: input.isCompleted,
        dueDate: input.dueDate,
        createdAt: input.createdAt,
        completedAt: input.completedAt ?? null,
        createdById: input.userId ?? null,
      },
      include: this.taskInclude,
    });

    await this.emitTaskCreatedNotification({
      instanceId: input.instanceId,
      projectId: input.projectId,
      actorUserId: input.userId,
      taskId: createdTask.id,
      description: createdTask.description,
      status: createdTask.status,
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'PlanningTask',
      entityId: createdTask.id,
      after: createdTask as Record<string, unknown>,
    });

    return createdTask;
  }

  async updateTask(
    id: string,
    instanceId: string,
    data: Partial<CreateTaskInput>,
    userId?: string,
  ) {
    let task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      include: {
        projectPlanning: {
          select: { projectId: true },
        },
      },
    });
    if (!task && userId) {
      task = await this.prisma.planningTask.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        include: {
          projectPlanning: {
            select: { projectId: true },
          },
        },
      });
    }
    if (!task) throw new NotFoundException('Tarefa nao encontrada');

    await this.ensurePlanningWritable(task.projectPlanningId);

    const nextStatus = data.status ?? task.status;
    const statusChanged = nextStatus !== task.status;
    const nextDescription = data.description ?? task.description;

    const updatedTask = await this.prisma.planningTask.update({
      where: { id },
      data: {
        categoryId: data.categoryId ?? task.categoryId,
        description: data.description ?? task.description,
        status: data.status ?? task.status,
        isCompleted: data.isCompleted ?? task.isCompleted,
        dueDate: data.dueDate ?? task.dueDate,
        createdAt: data.createdAt ?? task.createdAt,
        completedAt: data.completedAt ?? task.completedAt,
      },
      include: this.taskInclude,
    });

    void this.auditService.log({
      instanceId,
      userId,
      projectId: task.projectPlanning.projectId,
      action: 'UPDATE',
      model: 'PlanningTask',
      entityId: id,
      before: task as Record<string, unknown>,
      after: updatedTask as Record<string, unknown>,
    });

    if (statusChanged) {
      await this.emitTaskStatusChangedNotification({
        instanceId,
        projectId: task.projectPlanning.projectId,
        actorUserId: userId,
        taskId: updatedTask.id,
        description: nextDescription,
        oldStatus: task.status,
        newStatus: nextStatus,
      });
    }

    return updatedTask;
  }

  async deleteTask(id: string, instanceId: string, userId?: string) {
    let task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true, projectPlanningId: true },
    });
    if (!task && userId) {
      task = await this.prisma.planningTask.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: { id: true, projectPlanningId: true },
      });
    }
    if (!task) throw new NotFoundException('Tarefa nao encontrada');

    await this.ensurePlanningWritable(task.projectPlanningId);

    await this.prisma.planningTask.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'PlanningTask',
      entityId: id,
      before: task as Record<string, unknown>,
    });

    return { deleted: 1 };
  }

  async listForecasts(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.materialForecast.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { order: 'asc' },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
        supplyGroup: {
          include: {
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  async listSupplyGroups(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    await this.ensureProject(projectId, instanceId, userId);
    const planning = await this.ensurePlanning(projectId);

    return this.prisma.supplyGroup.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { createdAt: 'asc' },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: {
          orderBy: { order: 'asc' },
          include: {
            createdBy: {
              select: { id: true, name: true, profileImage: true },
            },
          },
        },
      },
    });
  }

  async createSupplyGroup(input: CreateSupplyGroupInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const planning = await this.ensurePlanning(input.projectId);

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Informe ao menos um item no grupo.');
    }

    const { group, syncedExpenses } = await this.prisma.$transaction(
      async (tx) => {
        const createdGroup = await tx.supplyGroup.create({
          data: {
            title: input.title ?? null,
            estimatedDate: input.estimatedDate,
            purchaseDate: input.purchaseDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            status: input.status,
            isPaid: input.isPaid,
            isCleared: input.isCleared,
            supplierId: this.normalizeRelationId(input.supplierId),
            paymentProof: input.paymentProof ?? null,
            invoiceDoc: input.invoiceDoc ?? null,
            createdById: input.userId ?? null,
            projectPlanningId: planning.id,
          },
        });

        await tx.materialForecast.createMany({
          data: input.items.map((item, index) => ({
            ...(item.id ? { id: item.id } : {}),
            projectPlanningId: planning.id,
            description: item.description,
            unit: item.unit,
            quantityNeeded: item.quantityNeeded,
            unitPrice: item.unitPrice,
            discountValue: item.discountValue ?? null,
            discountPercentage: item.discountPercentage ?? null,
            categoryId: item.categoryId ?? null,
            estimatedDate: input.estimatedDate,
            purchaseDate: input.purchaseDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            status: input.status,
            isPaid: input.isPaid,
            isCleared: input.isCleared,
            order: item.order ?? index,
            supplierId: this.normalizeRelationId(input.supplierId),
            paymentProof: input.paymentProof ?? null,
            createdById: input.userId ?? null,
            supplyGroupId: createdGroup.id,
          })),
        });

        // Sync expenses for all forecasts if group is ordered/delivered
        let expenses: Array<{
          id: string;
          expense: Record<string, unknown> | null;
        }> = [];
        if (input.status === 'ordered' || input.status === 'delivered') {
          const forecasts = await tx.materialForecast.findMany({
            where: { supplyGroupId: createdGroup.id },
          });
          expenses = await this.syncExpensesForForecasts(
            tx,
            forecasts,
            input.projectId,
          );
        }

        return { group: createdGroup, syncedExpenses: expenses };
      },
    );

    if (group.status === 'ordered') {
      void this.emitSupplyOrderedNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: group.id,
        label: group.title?.trim() || `Lote ${group.id.slice(0, 8)}`,
        referenceId: group.id,
      }).catch(() => undefined);
    }

    if (group.isPaid) {
      void this.emitSupplyPaymentNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: group.id,
        label: group.title?.trim() || `Lote ${group.id.slice(0, 8)}`,
        referenceId: group.id,
      }).catch(() => undefined);
    }

    const result = await this.prisma.supplyGroup.findUnique({
      where: { id: group.id },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'SupplyGroup',
      entityId: group.id,
      after: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
    });

    return { ...result, syncedExpenses };
  }

  async updateSupplyGroup(
    id: string,
    instanceId: string,
    data: UpdateSupplyGroupInput,
    userId?: string,
  ) {
    let group = await this.prisma.supplyGroup.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });

    if (!group && userId) {
      group = await this.prisma.supplyGroup.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
      });
    }

    if (!group)
      throw new NotFoundException('Grupo de suprimentos nao encontrado');

    await this.ensurePlanningWritable(group.projectPlanningId);

    const before = JSON.parse(JSON.stringify(group)) as Record<string, unknown>;

    const resolvedSupplierId = Object.prototype.hasOwnProperty.call(
      data,
      'supplierId',
    )
      ? this.normalizeRelationId(data.supplierId)
      : group.supplierId;

    const { updated, resolvedProjectId, syncedExpenses, fullGroup } =
      await this.prisma.$transaction(async (tx) => {
        const updatedGroup = await tx.supplyGroup.update({
          where: { id },
          data: {
            title: data.title ?? group.title,
            estimatedDate: data.estimatedDate ?? group.estimatedDate,
            purchaseDate: Object.prototype.hasOwnProperty.call(
              data,
              'purchaseDate',
            )
              ? (data.purchaseDate ?? null)
              : group.purchaseDate,
            deliveryDate: Object.prototype.hasOwnProperty.call(
              data,
              'deliveryDate',
            )
              ? (data.deliveryDate ?? null)
              : group.deliveryDate,
            status: data.status ?? group.status,
            isPaid: data.isPaid ?? group.isPaid,
            isCleared: data.isCleared ?? group.isCleared,
            supplierId: resolvedSupplierId,
            paymentProof: Object.prototype.hasOwnProperty.call(
              data,
              'paymentProof',
            )
              ? (data.paymentProof ?? null)
              : group.paymentProof,
            invoiceDoc: Object.prototype.hasOwnProperty.call(data, 'invoiceDoc')
              ? (data.invoiceDoc ?? null)
              : group.invoiceDoc,
          },
        });

        await tx.materialForecast.updateMany({
          where: { supplyGroupId: id },
          data: {
            estimatedDate: updatedGroup.estimatedDate,
            purchaseDate: updatedGroup.purchaseDate,
            deliveryDate: updatedGroup.deliveryDate,
            status: updatedGroup.status,
            isPaid: updatedGroup.isPaid,
            isCleared: updatedGroup.isCleared,
            supplierId: updatedGroup.supplierId,
            paymentProof: updatedGroup.paymentProof,
          },
        });

        // Fetch updated forecasts and sync their expenses atomically
        const forecasts = await tx.materialForecast.findMany({
          where: { supplyGroupId: id },
        });
        const projId = await this.resolveProjectId(
          tx,
          updatedGroup.projectPlanningId,
        );
        const expenses = await this.syncExpensesForForecasts(
          tx,
          forecasts,
          projId,
        );

        const result = await tx.supplyGroup.findUnique({
          where: { id },
          include: {
            supplier: { select: { id: true, name: true } },
            forecasts: { orderBy: { order: 'asc' } },
          },
        });

        return {
          updated: updatedGroup,
          resolvedProjectId: projId,
          syncedExpenses: expenses,
          fullGroup: result,
        };
      });

    if (group.status !== 'ordered' && updated.status === 'ordered') {
      void this.emitSupplyOrderedNotification({
        instanceId,
        projectId: resolvedProjectId,
        actorUserId: userId,
        supplyGroupId: updated.id,
        label: updated.title?.trim() || `Lote ${updated.id.slice(0, 8)}`,
        referenceId: updated.id,
      }).catch(() => undefined);
    }

    if (!group.isPaid && updated.isPaid) {
      void this.emitSupplyPaymentNotification({
        instanceId,
        projectId: resolvedProjectId,
        actorUserId: userId,
        supplyGroupId: updated.id,
        label: updated.title?.trim() || `Lote ${updated.id.slice(0, 8)}`,
        referenceId: updated.id,
      }).catch(() => undefined);
    }

    void this.auditService.log({
      instanceId,
      userId,
      projectId: resolvedProjectId,
      action: 'UPDATE',
      model: 'SupplyGroup',
      entityId: id,
      before,
      after: JSON.parse(JSON.stringify(fullGroup)) as Record<string, unknown>,
    });

    return { ...fullGroup, syncedExpenses };
  }

  async addItemsToSupplyGroup(
    groupId: string,
    items: SupplyGroupItemInput[],
    instanceId: string,
    userId?: string,
  ) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Informe ao menos um item para adicionar.');
    }

    let group = await this.prisma.supplyGroup.findFirst({
      where: { id: groupId, projectPlanning: { project: { instanceId } } },
    });

    if (!group && userId) {
      group = await this.prisma.supplyGroup.findFirst({
        where: {
          id: groupId,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
      });
    }

    if (!group)
      throw new NotFoundException('Grupo de suprimentos nao encontrado');

    await this.ensurePlanningWritable(group.projectPlanningId);

    const count = await this.prisma.materialForecast.count({
      where: { supplyGroupId: groupId },
    });

    const { syncedExpenses } = await this.prisma.$transaction(async (tx) => {
      await tx.materialForecast.createMany({
        data: items.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}),
          projectPlanningId: group.projectPlanningId,
          description: item.description,
          unit: item.unit,
          quantityNeeded: item.quantityNeeded,
          unitPrice: item.unitPrice,
          discountValue: item.discountValue ?? null,
          discountPercentage: item.discountPercentage ?? null,
          categoryId: item.categoryId ?? null,
          estimatedDate: group.estimatedDate,
          purchaseDate: group.purchaseDate,
          deliveryDate: group.deliveryDate,
          status: group.status,
          isPaid: group.isPaid,
          isCleared: group.isCleared,
          order: item.order ?? count + index,
          supplierId: group.supplierId,
          paymentProof: group.paymentProof,
          createdById: userId ?? null,
          supplyGroupId: groupId,
        })),
      });

      // Sync expenses for newly added items if group is non-pending
      let expenses: Array<{
        id: string;
        expense: Record<string, unknown> | null;
      }> = [];
      if (group.status === 'ordered' || group.status === 'delivered') {
        const newItemIds = items.filter((i) => i.id).map((i) => i.id!);
        let newForecasts: Awaited<
          ReturnType<typeof tx.materialForecast.findMany>
        > = [];
        if (newItemIds.length > 0) {
          newForecasts = await tx.materialForecast.findMany({
            where: { id: { in: newItemIds } },
          });
        } else {
          // Items without explicit IDs: fetch all group forecasts beyond old count
          const allForecasts = await tx.materialForecast.findMany({
            where: { supplyGroupId: groupId },
            orderBy: { order: 'asc' },
          });
          newForecasts = allForecasts.slice(count);
        }
        if (newForecasts.length > 0) {
          const projectId = await this.resolveProjectId(
            tx,
            group.projectPlanningId,
          );
          expenses = await this.syncExpensesForForecasts(
            tx,
            newForecasts,
            projectId,
          );
        }
      }
      return { syncedExpenses: expenses };
    });

    const result = await this.prisma.supplyGroup.findUnique({
      where: { id: groupId },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });

    return { ...result, syncedExpenses };
  }

  async deleteSupplyGroup(id: string, instanceId: string, userId?: string) {
    let group = await this.prisma.supplyGroup.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: {
        id: true,
        projectPlanningId: true,
        paymentProof: true,
        invoiceDoc: true,
      },
    });

    if (!group && userId) {
      group = await this.prisma.supplyGroup.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: {
          id: true,
          projectPlanningId: true,
          paymentProof: true,
          invoiceDoc: true,
        },
      });
    }

    if (!group)
      throw new NotFoundException('Grupo de suprimentos nao encontrado');

    await this.ensurePlanningWritable(group.projectPlanningId);

    const forecasts = await this.prisma.materialForecast.findMany({
      where: { supplyGroupId: id },
      select: { id: true, paymentProof: true },
    });

    const forecastIds = forecasts.map((f) => f.id);

    const candidateUploads: Array<string | null | undefined> = [
      group.paymentProof,
      group.invoiceDoc,
      ...forecasts.map((forecast) => forecast.paymentProof),
    ];

    await this.prisma.$transaction(async (tx) => {
      // Delete synced expenses, then forecasts, then group — atomically
      await this.deleteExpensesForForecasts(tx, forecastIds);
      await tx.materialForecast.deleteMany({ where: { supplyGroupId: id } });
      await tx.supplyGroup.delete({ where: { id } });
    });

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'SupplyGroup',
      entityId: id,
      before: JSON.parse(JSON.stringify(group)) as Record<string, unknown>,
      metadata: { deletedForecasts: forecasts.length } as Record<
        string,
        unknown
      >,
    });

    return { deleted: forecasts.length, deletedExpenseIds: forecastIds };
  }

  async convertForecastsToGroup(input: ConvertForecastsToGroupInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const planning = await this.ensurePlanning(input.projectId);

    if (!Array.isArray(input.forecastIds) || input.forecastIds.length === 0) {
      throw new BadRequestException(
        'Selecione ao menos um suprimento para converter.',
      );
    }

    const forecasts = await this.prisma.materialForecast.findMany({
      where: {
        id: { in: input.forecastIds },
        projectPlanningId: planning.id,
      },
      select: { id: true },
    });

    if (forecasts.length !== input.forecastIds.length) {
      throw new NotFoundException(
        'Um ou mais suprimentos nao foram encontrados.',
      );
    }

    const { group, syncedExpenses } = await this.prisma.$transaction(
      async (tx) => {
        const createdGroup = await tx.supplyGroup.create({
          data: {
            title: input.title ?? null,
            estimatedDate: input.estimatedDate,
            purchaseDate: input.purchaseDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            status: input.status,
            isPaid: input.isPaid,
            isCleared: input.isCleared,
            supplierId: this.normalizeRelationId(input.supplierId),
            paymentProof: input.paymentProof ?? null,
            invoiceDoc: input.invoiceDoc ?? null,
            createdById: input.userId ?? null,
            projectPlanningId: planning.id,
          },
        });

        await tx.materialForecast.updateMany({
          where: {
            id: { in: input.forecastIds },
            projectPlanningId: planning.id,
          },
          data: {
            supplyGroupId: createdGroup.id,
            estimatedDate: input.estimatedDate,
            purchaseDate: input.purchaseDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            status: input.status,
            isPaid: input.isPaid,
            isCleared: input.isCleared,
            supplierId: this.normalizeRelationId(input.supplierId),
            paymentProof: input.paymentProof ?? null,
          },
        });

        // Sync expenses for converted forecasts if non-pending
        let expenses: Array<{
          id: string;
          expense: Record<string, unknown> | null;
        }> = [];
        if (input.status === 'ordered' || input.status === 'delivered') {
          const updatedForecasts = await tx.materialForecast.findMany({
            where: { supplyGroupId: createdGroup.id },
          });
          expenses = await this.syncExpensesForForecasts(
            tx,
            updatedForecasts,
            input.projectId,
          );
        }

        return { group: createdGroup, syncedExpenses: expenses };
      },
    );

    const groupLabel = group.title?.trim() || `Lote ${group.id.slice(0, 8)}`;

    if (group.status === 'ordered') {
      void this.emitSupplyOrderedNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: group.id,
        label: groupLabel,
        referenceId: group.id,
      }).catch(() => undefined);
    }

    if (group.isPaid) {
      void this.emitSupplyPaymentNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: group.id,
        label: groupLabel,
        referenceId: group.id,
      }).catch(() => undefined);
    }

    const result = await this.prisma.supplyGroup.findUnique({
      where: { id: group.id },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'SupplyGroup',
      entityId: group.id,
      after: JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
      metadata: { convertedFrom: input.forecastIds } as Record<string, unknown>,
    });

    return { ...result, syncedExpenses };
  }

  async createForecast(input: CreateForecastInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const planning = await this.ensurePlanning(input.projectId);

    const { created, syncedExpense } = await this.prisma.$transaction(
      async (tx) => {
        const forecast = await tx.materialForecast.create({
          data: {
            id: input.id,
            projectPlanningId: planning.id,
            categoryId: input.categoryId ?? null,
            description: input.description,
            calculationMemory: input.calculationMemory ?? null,
            unit: input.unit,
            quantityNeeded: input.quantityNeeded,
            unitPrice: input.unitPrice,
            discountValue: input.discountValue ?? null,
            discountPercentage: input.discountPercentage ?? null,
            estimatedDate: input.estimatedDate,
            purchaseDate: input.purchaseDate ?? null,
            deliveryDate: input.deliveryDate ?? null,
            status: input.status,
            isPaid: input.isPaid,
            isCleared: input.isCleared ?? false,
            order: input.order ?? 0,
            supplierId: this.normalizeRelationId(input.supplierId),
            supplyGroupId: this.normalizeRelationId(input.supplyGroupId),
            paymentProof: input.paymentProof ?? null,
            createdById: input.userId ?? input.createdById ?? null,
          },
        });

        const expense = await this.syncExpenseForForecast(
          tx,
          forecast,
          input.projectId,
        );
        return { created: forecast, syncedExpense: expense };
      },
    );

    const supplyGroupLabel = created.supplyGroupId
      ? (
          await this.prisma.supplyGroup.findUnique({
            where: { id: created.supplyGroupId },
            select: { title: true },
          })
        )?.title?.trim() || `Lote ${created.supplyGroupId.slice(0, 8)}`
      : created.description;

    if (created.status === 'ordered') {
      void this.emitSupplyOrderedNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: created.supplyGroupId,
        label: supplyGroupLabel,
        referenceId: created.id,
      }).catch(() => undefined);
    }

    if (created.isPaid) {
      void this.emitSupplyPaymentNotification({
        instanceId: input.instanceId,
        projectId: input.projectId,
        actorUserId: input.userId,
        supplyGroupId: created.supplyGroupId,
        label: supplyGroupLabel,
        referenceId: created.id,
      }).catch(() => undefined);
    }

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      projectId: input.projectId,
      action: 'CREATE',
      model: 'MaterialForecast',
      entityId: created.id,
      after: created as Record<string, unknown>,
    });

    return { ...created, syncedExpense };
  }

  async updateForecast(
    id: string,
    instanceId: string,
    data: Partial<CreateForecastInput>,
    userId?: string,
  ) {
    let forecast = await this.prisma.materialForecast.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
    if (!forecast && userId) {
      forecast = await this.prisma.materialForecast.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
      });
    }
    if (!forecast) throw new NotFoundException('Previsao nao encontrada');

    await this.ensurePlanningWritable(forecast.projectPlanningId);

    const nextStatus = data.status ?? forecast.status;
    const nextIsPaid = data.isPaid ?? forecast.isPaid;
    const nextPaymentProof = Object.prototype.hasOwnProperty.call(
      data,
      'paymentProof',
    )
      ? (data.paymentProof ?? null)
      : forecast.paymentProof;
    if (nextStatus === 'pending' && forecast.status !== 'pending') {
      throw new BadRequestException(
        'Nao e possivel voltar para pendente apos comprado.',
      );
    }
    if (nextStatus === 'pending' && nextIsPaid && nextPaymentProof) {
      throw new BadRequestException(
        'Nao e possivel voltar para pendente apos pagamento.',
      );
    }

    const resolvedSupplierId = Object.prototype.hasOwnProperty.call(
      data,
      'supplierId',
    )
      ? this.normalizeRelationId(data.supplierId)
      : forecast.supplierId;
    const resolvedSupplyGroupId = Object.prototype.hasOwnProperty.call(
      data,
      'supplyGroupId',
    )
      ? this.normalizeRelationId(data.supplyGroupId)
      : forecast.supplyGroupId;

    const { updated, syncedExpense } = await this.prisma.$transaction(
      async (tx) => {
        const updatedForecast = await tx.materialForecast.update({
          where: { id },
          data: {
            categoryId: Object.prototype.hasOwnProperty.call(data, 'categoryId')
              ? (data.categoryId ?? null)
              : forecast.categoryId,
            description: data.description ?? forecast.description,
            calculationMemory: Object.prototype.hasOwnProperty.call(
              data,
              'calculationMemory',
            )
              ? (data.calculationMemory ?? null)
              : forecast.calculationMemory,
            unit: data.unit ?? forecast.unit,
            quantityNeeded: data.quantityNeeded ?? forecast.quantityNeeded,
            unitPrice: data.unitPrice ?? forecast.unitPrice,
            discountValue: data.discountValue ?? forecast.discountValue,
            discountPercentage:
              data.discountPercentage ?? forecast.discountPercentage,
            estimatedDate: data.estimatedDate ?? forecast.estimatedDate,
            purchaseDate: Object.prototype.hasOwnProperty.call(
              data,
              'purchaseDate',
            )
              ? (data.purchaseDate ?? null)
              : forecast.purchaseDate,
            deliveryDate: Object.prototype.hasOwnProperty.call(
              data,
              'deliveryDate',
            )
              ? (data.deliveryDate ?? null)
              : forecast.deliveryDate,
            status: data.status ?? forecast.status,
            isPaid: data.isPaid ?? forecast.isPaid,
            isCleared: data.isCleared ?? forecast.isCleared,
            order: data.order ?? forecast.order,
            supplierId: resolvedSupplierId,
            supplyGroupId: resolvedSupplyGroupId,
            paymentProof: Object.prototype.hasOwnProperty.call(
              data,
              'paymentProof',
            )
              ? (data.paymentProof ?? null)
              : forecast.paymentProof,
          },
        });

        const projectId = await this.resolveProjectId(
          tx,
          updatedForecast.projectPlanningId,
        );
        const expense = await this.syncExpenseForForecast(
          tx,
          updatedForecast,
          projectId,
        );
        return { updated: updatedForecast, syncedExpense: expense };
      },
    );

    const planning = await this.prisma.projectPlanning.findUnique({
      where: { id: updated.projectPlanningId },
      select: { projectId: true },
    });

    if (planning) {
      const supplyGroupLabel = updated.supplyGroupId
        ? (
            await this.prisma.supplyGroup.findUnique({
              where: { id: updated.supplyGroupId },
              select: { title: true },
            })
          )?.title?.trim() || `Lote ${updated.supplyGroupId.slice(0, 8)}`
        : updated.description;

      if (forecast.status !== 'ordered' && updated.status === 'ordered') {
        void this.emitSupplyOrderedNotification({
          instanceId,
          projectId: planning.projectId,
          actorUserId: userId,
          supplyGroupId: updated.supplyGroupId,
          label: supplyGroupLabel,
          referenceId: updated.id,
        }).catch(() => undefined);
      }

      if (!forecast.isPaid && updated.isPaid) {
        void this.emitSupplyPaymentNotification({
          instanceId,
          projectId: planning.projectId,
          actorUserId: userId,
          supplyGroupId: updated.supplyGroupId,
          label: supplyGroupLabel,
          referenceId: updated.id,
        }).catch(() => undefined);
      }
    }

    void this.auditService.log({
      instanceId,
      userId,
      projectId: planning?.projectId,
      action: 'UPDATE',
      model: 'MaterialForecast',
      entityId: id,
      before: forecast as Record<string, unknown>,
      after: updated as Record<string, unknown>,
    });

    return { ...updated, syncedExpense };
  }

  async deleteForecast(id: string, instanceId: string, userId?: string) {
    let forecast = await this.prisma.materialForecast.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: {
        id: true,
        paymentProof: true,
        supplyGroupId: true,
        projectPlanningId: true,
      },
    });
    if (!forecast && userId) {
      forecast = await this.prisma.materialForecast.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: {
          id: true,
          paymentProof: true,
          supplyGroupId: true,
          projectPlanningId: true,
        },
      });
    }
    if (!forecast) throw new NotFoundException('Previsao nao encontrada');

    await this.ensurePlanningWritable(forecast.projectPlanningId);

    const candidateUploads: Array<string | null | undefined> = [
      forecast.paymentProof,
    ];

    await this.prisma.$transaction(async (tx) => {
      // Delete forecast and its corresponding expense atomically
      await tx.materialForecast.delete({ where: { id } });
      await tx.projectExpense.deleteMany({ where: { id } });

      if (forecast.supplyGroupId) {
        const [remainingInGroup, group] = await Promise.all([
          tx.materialForecast.count({
            where: { supplyGroupId: forecast.supplyGroupId },
          }),
          tx.supplyGroup.findUnique({
            where: { id: forecast.supplyGroupId },
            select: { id: true, paymentProof: true, invoiceDoc: true },
          }),
        ]);

        if (group && remainingInGroup === 0) {
          candidateUploads.push(group.paymentProof, group.invoiceDoc);
          await tx.supplyGroup.delete({ where: { id: group.id } });
        }
      }
    });

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'MaterialForecast',
      entityId: id,
      before: forecast as Record<string, unknown>,
    });

    return { deleted: 1, deletedExpenseId: id };
  }

  async listMilestones(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.milestone.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { date: 'asc' },
    });
  }

  async createMilestone(input: CreateMilestoneInput) {
    await this.ensureProject(
      input.projectId,
      input.instanceId,
      input.userId,
      true,
    );
    const planning = await this.ensurePlanning(input.projectId);

    return this.prisma.milestone
      .create({
        data: {
          id: input.id,
          projectPlanningId: planning.id,
          title: input.title,
          date: input.date,
          isCompleted: input.isCompleted,
          createdById: input.userId ?? null,
        },
      })
      .then((created) => {
        void this.auditService.log({
          instanceId: input.instanceId,
          userId: input.userId,
          projectId: input.projectId,
          action: 'CREATE',
          model: 'Milestone',
          entityId: created.id,
          after: created as Record<string, unknown>,
        });
        return created;
      });
  }

  async updateMilestone(
    id: string,
    instanceId: string,
    data: Partial<CreateMilestoneInput>,
    userId?: string,
  ) {
    let milestone = await this.prisma.milestone.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
    if (!milestone && userId) {
      milestone = await this.prisma.milestone.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
      });
    }
    if (!milestone) throw new NotFoundException('Marco nao encontrado');

    await this.ensurePlanningWritable(milestone.projectPlanningId);

    return this.prisma.milestone
      .update({
        where: { id },
        data: {
          title: data.title ?? milestone.title,
          date: data.date ?? milestone.date,
          isCompleted: data.isCompleted ?? milestone.isCompleted,
          updatedById: userId ?? null,
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId,
          userId,
          action: 'UPDATE',
          model: 'Milestone',
          entityId: id,
          before: milestone as Record<string, unknown>,
          after: updated as Record<string, unknown>,
        });
        return updated;
      });
  }

  async replaceAll(
    projectId: string,
    tasks: Array<Omit<CreateTaskInput, 'instanceId'>>,
    forecasts: Array<Omit<CreateForecastInput, 'instanceId'>>,
    milestones: Array<Omit<CreateMilestoneInput, 'instanceId'>>,
    instanceId: string,
    userId?: string,
  ): Promise<{ replaced: number }> {
    await this.ensureProject(projectId, instanceId, userId, true);
    const planning = await this.ensurePlanning(projectId);

    const [existingForecastAttachments, existingGroupAttachments] =
      await Promise.all([
        this.prisma.materialForecast.findMany({
          where: { projectPlanningId: planning.id },
          select: { paymentProof: true },
        }),
        this.prisma.supplyGroup.findMany({
          where: { projectPlanningId: planning.id },
          select: { paymentProof: true, invoiceDoc: true },
        }),
      ]);

    const candidateUploads = [
      ...existingForecastAttachments.map((item) => item.paymentProof),
      ...existingGroupAttachments.flatMap((item) => [
        item.paymentProof,
        item.invoiceDoc,
      ]),
    ];

    const taskData = tasks.map((t) => ({
      ...(t.id ? { id: t.id } : {}),
      projectPlanningId: planning.id,
      categoryId: t.categoryId ?? null,
      description: t.description,
      status: t.status,
      isCompleted: t.isCompleted,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      completedAt: t.completedAt ?? null,
    }));

    const forecastData = forecasts.map((f) => ({
      ...(f.id ? { id: f.id } : {}),
      projectPlanningId: planning.id,
      description: f.description,
      unit: f.unit,
      quantityNeeded: f.quantityNeeded,
      unitPrice: f.unitPrice,
      discountValue: f.discountValue ?? null,
      discountPercentage: f.discountPercentage ?? null,
      estimatedDate: f.estimatedDate,
      purchaseDate: f.purchaseDate ?? null,
      deliveryDate: f.deliveryDate ?? null,
      status: f.status,
      isPaid: f.isPaid,
      isCleared: f.isCleared ?? false,
      order: f.order ?? 0,
      supplierId: f.supplierId ?? null,
      supplyGroupId: f.supplyGroupId ?? null,
      paymentProof: f.paymentProof ?? null,
      createdById: f.createdById ?? null,
    }));

    const milestoneData = milestones.map((m) => ({
      ...(m.id ? { id: m.id } : {}),
      projectPlanningId: planning.id,
      title: m.title,
      date: m.date,
      isCompleted: m.isCompleted,
    }));

    await this.prisma.$transaction(async (tx) => {
      // Delete existing data (expenses for forecasts first)
      const existingForecastIds = await tx.materialForecast.findMany({
        where: { projectPlanningId: planning.id },
        select: { id: true },
      });
      await this.deleteExpensesForForecasts(
        tx,
        existingForecastIds.map((f) => f.id),
      );

      await tx.planningTask.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await tx.materialForecast.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await tx.supplyGroup.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await tx.milestone.deleteMany({
        where: { projectPlanningId: planning.id },
      });

      // Create new data
      await tx.planningTask.createMany({ data: taskData });
      await tx.materialForecast.createMany({ data: forecastData });
      await tx.milestone.createMany({ data: milestoneData });

      // Sync expenses for ordered/delivered forecasts
      const nonPendingForecasts = await tx.materialForecast.findMany({
        where: {
          projectPlanningId: planning.id,
          status: { in: ['ordered', 'delivered'] },
        },
      });
      if (nonPendingForecasts.length > 0) {
        await this.syncExpensesForForecasts(tx, nonPendingForecasts, projectId);
      }
    });

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    void this.auditService.log({
      instanceId,
      userId,
      projectId,
      action: 'UPDATE',
      model: 'ProjectPlanning',
      entityId: planning.id,
      metadata: {
        operation: 'replaceAll',
        tasks: tasks.length,
        forecasts: forecasts.length,
        milestones: milestones.length,
      } as Record<string, unknown>,
    });

    return { replaced: tasks.length + forecasts.length + milestones.length };
  }

  async deleteMilestone(id: string, instanceId: string, userId?: string) {
    let milestone = await this.prisma.milestone.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true, projectPlanningId: true },
    });
    if (!milestone && userId) {
      milestone = await this.prisma.milestone.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: { id: true, projectPlanningId: true },
      });
    }
    if (!milestone) throw new NotFoundException('Marco nao encontrado');

    await this.ensurePlanningWritable(milestone.projectPlanningId);

    await this.prisma.milestone.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'Milestone',
      entityId: id,
      before: milestone as Record<string, unknown>,
    });

    return { deleted: 1 };
  }
}
