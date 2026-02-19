import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isLocalUpload, removeLocalUpload } from '../uploads/file.utils';
import { ensureProjectAccess } from '../common/project-access.util';

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
  constructor(private readonly prisma: PrismaService) {}

  private async canRemoveUpload(url?: string | null) {
    if (!isLocalUpload(url)) return false;

    const [forecastPayment, expensePayment, expenseInvoice, groupPayment, groupInvoice] = await Promise.all([
      this.prisma.materialForecast.count({ where: { paymentProof: url } }),
      this.prisma.projectExpense.count({ where: { paymentProof: url } }),
      this.prisma.projectExpense.count({ where: { invoiceDoc: url } }),
      this.prisma.supplyGroup.count({ where: { paymentProof: url } }),
      this.prisma.supplyGroup.count({ where: { invoiceDoc: url } }),
    ]);

    return (
      forecastPayment + expensePayment + expenseInvoice + groupPayment + groupInvoice ===
      0
    );
  }

  private async cleanupUploadsIfOrphaned(urls: Array<string | null | undefined>) {
    const unique = Array.from(new Set(urls.filter(Boolean))) as string[];
    for (const url of unique) {
      if (await this.canRemoveUpload(url)) {
        await removeLocalUpload(url);
      }
    }
  }

  private async ensureProject(
    projectId: string,
    instanceId: string,
    userId?: string,
  ) {
    return ensureProjectAccess(this.prisma, projectId, instanceId, userId);
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

  async listTasks(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.planningTask.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTask(input: CreateTaskInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const planning = await this.ensurePlanning(input.projectId);

    return this.prisma.planningTask.create({
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
      },
    });
  }

  async updateTask(
    id: string,
    instanceId: string,
    data: Partial<CreateTaskInput>,
    userId?: string,
  ) {
    let task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
    if (!task && userId) {
      task = await this.prisma.planningTask.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
      });
    }
    if (!task) throw new NotFoundException('Tarefa nao encontrada');

    return this.prisma.planningTask.update({
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
    });
  }

  async deleteTask(id: string, instanceId: string, userId?: string) {
    let task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true },
    });
    if (!task && userId) {
      task = await this.prisma.planningTask.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: { id: true },
      });
    }
    if (!task) throw new NotFoundException('Tarefa nao encontrada');

    await this.prisma.planningTask.delete({ where: { id } });
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

  async listSupplyGroups(projectId: string, instanceId: string, userId?: string) {
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
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const planning = await this.ensurePlanning(input.projectId);

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestException('Informe ao menos um item no grupo.');
    }

    const group = await this.prisma.supplyGroup.create({
      data: {
        title: input.title ?? null,
        estimatedDate: input.estimatedDate,
        purchaseDate: input.purchaseDate ?? null,
        deliveryDate: input.deliveryDate ?? null,
        status: input.status,
        isPaid: input.isPaid,
        isCleared: input.isCleared,
        supplierId: input.supplierId ?? null,
        paymentProof: input.paymentProof ?? null,
        invoiceDoc: input.invoiceDoc ?? null,
        createdById: input.userId ?? null,
        projectPlanningId: planning.id,
      },
    });

    await this.prisma.materialForecast.createMany({
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
        supplierId: input.supplierId ?? null,
        paymentProof: input.paymentProof ?? null,
        createdById: input.userId ?? null,
        supplyGroupId: group.id,
      })),
    });

    return this.prisma.supplyGroup.findUnique({
      where: { id: group.id },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });
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

    if (!group) throw new NotFoundException('Grupo de suprimentos nao encontrado');

    const updated = await this.prisma.supplyGroup.update({
      where: { id },
      data: {
        title: data.title ?? group.title,
        estimatedDate: data.estimatedDate ?? group.estimatedDate,
        purchaseDate: data.purchaseDate ?? group.purchaseDate,
        deliveryDate: data.deliveryDate ?? group.deliveryDate,
        status: data.status ?? group.status,
        isPaid: data.isPaid ?? group.isPaid,
        isCleared: data.isCleared ?? group.isCleared,
        supplierId: data.supplierId ?? group.supplierId,
        paymentProof: data.paymentProof ?? group.paymentProof,
        invoiceDoc: data.invoiceDoc ?? group.invoiceDoc,
      },
    });

    await this.prisma.materialForecast.updateMany({
      where: { supplyGroupId: id },
      data: {
        estimatedDate: updated.estimatedDate,
        purchaseDate: updated.purchaseDate,
        deliveryDate: updated.deliveryDate,
        status: updated.status,
        isPaid: updated.isPaid,
        isCleared: updated.isCleared,
        supplierId: updated.supplierId,
        paymentProof: updated.paymentProof,
      },
    });

    return this.prisma.supplyGroup.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });
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

    if (!group) throw new NotFoundException('Grupo de suprimentos nao encontrado');

    const count = await this.prisma.materialForecast.count({
      where: { supplyGroupId: groupId },
    });

    await this.prisma.materialForecast.createMany({
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

    return this.prisma.supplyGroup.findUnique({
      where: { id: groupId },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });
  }

  async deleteSupplyGroup(id: string, instanceId: string, userId?: string) {
    let group = await this.prisma.supplyGroup.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: {
        id: true,
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
          paymentProof: true,
          invoiceDoc: true,
        },
      });
    }

    if (!group) throw new NotFoundException('Grupo de suprimentos nao encontrado');

    const forecasts = await this.prisma.materialForecast.findMany({
      where: { supplyGroupId: id },
      select: { id: true, paymentProof: true },
    });

    const candidateUploads: Array<string | null | undefined> = [
      group.paymentProof,
      group.invoiceDoc,
      ...forecasts.map((forecast) => forecast.paymentProof),
    ];

    await this.prisma.materialForecast.deleteMany({
      where: { supplyGroupId: id },
    });

    await this.prisma.supplyGroup.delete({ where: { id } });

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    return { deleted: forecasts.length };
  }

  async convertForecastsToGroup(input: ConvertForecastsToGroupInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const planning = await this.ensurePlanning(input.projectId);

    if (!Array.isArray(input.forecastIds) || input.forecastIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um suprimento para converter.');
    }

    const forecasts = await this.prisma.materialForecast.findMany({
      where: {
        id: { in: input.forecastIds },
        projectPlanningId: planning.id,
      },
      select: { id: true },
    });

    if (forecasts.length !== input.forecastIds.length) {
      throw new NotFoundException('Um ou mais suprimentos nao foram encontrados.');
    }

    const group = await this.prisma.supplyGroup.create({
      data: {
        title: input.title ?? null,
        estimatedDate: input.estimatedDate,
        purchaseDate: input.purchaseDate ?? null,
        deliveryDate: input.deliveryDate ?? null,
        status: input.status,
        isPaid: input.isPaid,
        isCleared: input.isCleared,
        supplierId: input.supplierId ?? null,
        paymentProof: input.paymentProof ?? null,
        invoiceDoc: input.invoiceDoc ?? null,
        createdById: input.userId ?? null,
        projectPlanningId: planning.id,
      },
    });

    await this.prisma.materialForecast.updateMany({
      where: {
        id: { in: input.forecastIds },
        projectPlanningId: planning.id,
      },
      data: {
        supplyGroupId: group.id,
        estimatedDate: input.estimatedDate,
        purchaseDate: input.purchaseDate ?? null,
        deliveryDate: input.deliveryDate ?? null,
        status: input.status,
        isPaid: input.isPaid,
        isCleared: input.isCleared,
        supplierId: input.supplierId ?? null,
        paymentProof: input.paymentProof ?? null,
      },
    });

    return this.prisma.supplyGroup.findUnique({
      where: { id: group.id },
      include: {
        supplier: { select: { id: true, name: true } },
        forecasts: { orderBy: { order: 'asc' } },
      },
    });
  }

  async createForecast(input: CreateForecastInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const planning = await this.ensurePlanning(input.projectId);

    return this.prisma.materialForecast.create({
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
        supplierId: input.supplierId ?? null,
        supplyGroupId: input.supplyGroupId ?? null,
        paymentProof: input.paymentProof ?? null,
        createdById: input.userId ?? input.createdById ?? null,
      },
    });
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

    const nextStatus = data.status ?? forecast.status;
    const nextIsPaid = data.isPaid ?? forecast.isPaid;
    const nextPaymentProof = data.paymentProof ?? forecast.paymentProof;
    if (nextStatus === 'pending' && forecast.status !== 'pending') {
      throw new BadRequestException('Nao e possivel voltar para pendente apos comprado.');
    }
    if (nextStatus === 'pending' && nextIsPaid && nextPaymentProof) {
      throw new BadRequestException('Nao e possivel voltar para pendente apos pagamento.');
    }

    return this.prisma.materialForecast.update({
      where: { id },
      data: {
        categoryId:
          Object.prototype.hasOwnProperty.call(data, 'categoryId')
            ? (data.categoryId ?? null)
            : forecast.categoryId,
        description: data.description ?? forecast.description,
        calculationMemory:
          Object.prototype.hasOwnProperty.call(data, 'calculationMemory')
            ? (data.calculationMemory ?? null)
            : forecast.calculationMemory,
        unit: data.unit ?? forecast.unit,
        quantityNeeded: data.quantityNeeded ?? forecast.quantityNeeded,
        unitPrice: data.unitPrice ?? forecast.unitPrice,
        discountValue: data.discountValue ?? forecast.discountValue,
        discountPercentage: data.discountPercentage ?? forecast.discountPercentage,
        estimatedDate: data.estimatedDate ?? forecast.estimatedDate,
        purchaseDate: data.purchaseDate ?? forecast.purchaseDate,
        deliveryDate: data.deliveryDate ?? forecast.deliveryDate,
        status: data.status ?? forecast.status,
        isPaid: data.isPaid ?? forecast.isPaid,
        isCleared: data.isCleared ?? forecast.isCleared,
        order: data.order ?? forecast.order,
        supplierId: data.supplierId ?? forecast.supplierId,
        supplyGroupId: data.supplyGroupId ?? forecast.supplyGroupId,
        paymentProof: data.paymentProof ?? forecast.paymentProof,
      },
    });
  }

  async deleteForecast(id: string, instanceId: string, userId?: string) {
    let forecast = await this.prisma.materialForecast.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true, paymentProof: true, supplyGroupId: true },
    });
    if (!forecast && userId) {
      forecast = await this.prisma.materialForecast.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: { id: true, paymentProof: true, supplyGroupId: true },
      });
    }
    if (!forecast) throw new NotFoundException('Previsao nao encontrada');

    const candidateUploads: Array<string | null | undefined> = [forecast.paymentProof];

    await this.prisma.materialForecast.delete({ where: { id } });

    if (forecast.supplyGroupId) {
      const [remainingInGroup, group] = await Promise.all([
        this.prisma.materialForecast.count({
          where: { supplyGroupId: forecast.supplyGroupId },
        }),
        this.prisma.supplyGroup.findUnique({
          where: { id: forecast.supplyGroupId },
          select: { id: true, paymentProof: true, invoiceDoc: true },
        }),
      ]);

      if (group && remainingInGroup === 0) {
        candidateUploads.push(group.paymentProof, group.invoiceDoc);
        await this.prisma.supplyGroup.delete({ where: { id: group.id } });
      }
    }

    await this.cleanupUploadsIfOrphaned(candidateUploads);
    return { deleted: 1 };
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
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
    const planning = await this.ensurePlanning(input.projectId);

    return this.prisma.milestone.create({
      data: {
        id: input.id,
        projectPlanningId: planning.id,
        title: input.title,
        date: input.date,
        isCompleted: input.isCompleted,
      },
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

    return this.prisma.milestone.update({
      where: { id },
      data: {
        title: data.title ?? milestone.title,
        date: data.date ?? milestone.date,
        isCompleted: data.isCompleted ?? milestone.isCompleted,
      },
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
    await this.ensureProject(projectId, instanceId, userId);
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

    await this.prisma.$transaction([
      this.prisma.planningTask.deleteMany({
        where: {
          projectPlanningId: planning.id,
        },
      }),
      this.prisma.materialForecast.deleteMany({
        where: {
          projectPlanningId: planning.id,
        },
      }),
      this.prisma.supplyGroup.deleteMany({
        where: {
          projectPlanningId: planning.id,
        },
      }),
      this.prisma.milestone.deleteMany({
        where: {
          projectPlanningId: planning.id,
        },
      }),
      this.prisma.planningTask.createMany({ data: taskData }),
      this.prisma.materialForecast.createMany({ data: forecastData }),
      this.prisma.milestone.createMany({ data: milestoneData }),
    ]);

    await this.cleanupUploadsIfOrphaned(candidateUploads);

    return { replaced: tasks.length + forecasts.length + milestones.length };
  }

  async deleteMilestone(id: string, instanceId: string, userId?: string) {
    let milestone = await this.prisma.milestone.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true },
    });
    if (!milestone && userId) {
      milestone = await this.prisma.milestone.findFirst({
        where: {
          id,
          projectPlanning: { project: { members: { some: { userId } } } },
        },
        select: { id: true },
      });
    }
    if (!milestone) throw new NotFoundException('Marco nao encontrado');

    await this.prisma.milestone.delete({ where: { id } });
    return { deleted: 1 };
  }
}
