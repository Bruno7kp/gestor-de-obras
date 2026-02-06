import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload } from '../uploads/file.utils';

interface CreateTaskInput {
  id?: string;
  projectId: string;
  instanceId: string;
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
  description: string;
  unit: string;
  quantityNeeded: number;
  unitPrice: number;
  estimatedDate: string;
  purchaseDate?: string | null;
  deliveryDate?: string | null;
  status: string;
  isPaid: boolean;
  order?: number;
  supplierId?: string | null;
  paymentProof?: string | null;
}

interface CreateMilestoneInput {
  id?: string;
  projectId: string;
  instanceId: string;
  title: string;
  date: string;
  isCompleted: boolean;
}

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
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

  async listTasks(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.planningTask.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTask(input: CreateTaskInput) {
    await this.ensureProject(input.projectId, input.instanceId);
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
  ) {
    const task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
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

  async deleteTask(id: string, instanceId: string) {
    const task = await this.prisma.planningTask.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Tarefa nao encontrada');

    await this.prisma.planningTask.delete({ where: { id } });
    return { deleted: 1 };
  }

  async listForecasts(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.materialForecast.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { order: 'asc' },
    });
  }

  async createForecast(input: CreateForecastInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    const planning = await this.ensurePlanning(input.projectId);

    return this.prisma.materialForecast.create({
      data: {
        id: input.id,
        projectPlanningId: planning.id,
        description: input.description,
        unit: input.unit,
        quantityNeeded: input.quantityNeeded,
        unitPrice: input.unitPrice,
        estimatedDate: input.estimatedDate,
        purchaseDate: input.purchaseDate ?? null,
        deliveryDate: input.deliveryDate ?? null,
        status: input.status,
        isPaid: input.isPaid,
        order: input.order ?? 0,
        supplierId: input.supplierId ?? null,
        paymentProof: input.paymentProof ?? null,
      },
    });
  }

  async updateForecast(
    id: string,
    instanceId: string,
    data: Partial<CreateForecastInput>,
  ) {
    const forecast = await this.prisma.materialForecast.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
    if (!forecast) throw new NotFoundException('Previsao nao encontrada');

    return this.prisma.materialForecast.update({
      where: { id },
      data: {
        description: data.description ?? forecast.description,
        unit: data.unit ?? forecast.unit,
        quantityNeeded: data.quantityNeeded ?? forecast.quantityNeeded,
        unitPrice: data.unitPrice ?? forecast.unitPrice,
        estimatedDate: data.estimatedDate ?? forecast.estimatedDate,
        purchaseDate: data.purchaseDate ?? forecast.purchaseDate,
        deliveryDate: data.deliveryDate ?? forecast.deliveryDate,
        status: data.status ?? forecast.status,
        isPaid: data.isPaid ?? forecast.isPaid,
        order: data.order ?? forecast.order,
        supplierId: data.supplierId ?? forecast.supplierId,
        paymentProof: data.paymentProof ?? forecast.paymentProof,
      },
    });
  }

  async deleteForecast(id: string, instanceId: string) {
    const forecast = await this.prisma.materialForecast.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true, paymentProof: true },
    });
    if (!forecast) throw new NotFoundException('Previsao nao encontrada');

    await removeLocalUpload(forecast.paymentProof);
    await this.prisma.materialForecast.delete({ where: { id } });
    return { deleted: 1 };
  }

  async listMilestones(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    const planning = await this.ensurePlanning(projectId);
    return this.prisma.milestone.findMany({
      where: { projectPlanningId: planning.id },
      orderBy: { date: 'asc' },
    });
  }

  async createMilestone(input: CreateMilestoneInput) {
    await this.ensureProject(input.projectId, input.instanceId);
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
  ) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
    });
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
  ): Promise<{ replaced: number }> {
    await this.ensureProject(projectId, instanceId);
    const planning = await this.ensurePlanning(projectId);

    const taskData = tasks.map((t) => ({
      id: t.id,
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
      id: f.id,
      projectPlanningId: planning.id,
      description: f.description,
      unit: f.unit,
      quantityNeeded: f.quantityNeeded,
      unitPrice: f.unitPrice,
      estimatedDate: f.estimatedDate,
      purchaseDate: f.purchaseDate ?? null,
      deliveryDate: f.deliveryDate ?? null,
      status: f.status,
      isPaid: f.isPaid,
      order: f.order ?? 0,
      supplierId: f.supplierId ?? null,
      paymentProof: f.paymentProof ?? null,
    }));

    const milestoneData = milestones.map((m) => ({
      id: m.id,
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
      this.prisma.milestone.deleteMany({
        where: {
          projectPlanningId: planning.id,
        },
      }),
      this.prisma.planningTask.createMany({ data: taskData }),
      this.prisma.materialForecast.createMany({ data: forecastData }),
      this.prisma.milestone.createMany({ data: milestoneData }),
    ]);

    return { replaced: tasks.length + forecasts.length + milestones.length };
  }

  async deleteMilestone(id: string, instanceId: string) {
    const milestone = await this.prisma.milestone.findFirst({
      where: { id, projectPlanning: { project: { instanceId } } },
      select: { id: true },
    });
    if (!milestone) throw new NotFoundException('Marco nao encontrado');

    await this.prisma.milestone.delete({ where: { id } });
    return { deleted: 1 };
  }
}
