import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ensureProjectAccess,
  ensureProjectWritable,
  ensureEntityAccess,
} from '../common/project-access.util';
import type { StockMovementType } from '@prisma/client';

// --- DTOs ---

interface CreateStockItemInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  name: string;
  unit?: string;
  minQuantity?: number;
}

interface UpdateStockItemInput {
  id: string;
  instanceId: string;
  userId?: string;
  name?: string;
  unit?: string;
  minQuantity?: number;
}

interface AddMovementInput {
  stockItemId: string;
  instanceId: string;
  userId?: string;
  type: StockMovementType;
  quantity: number;
  responsible: string;
  notes?: string;
  date?: string;
}

interface ReorderInput {
  instanceId: string;
  userId?: string;
  projectId: string;
  items: Array<{ id: string; order: number }>;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);

    return this.prisma.stockItem.findMany({
      where: { projectId },
      include: {
        movements: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateStockItemInput) {
    await ensureProjectAccess(
      this.prisma,
      input.projectId,
      input.instanceId,
      input.userId,
    );
    await ensureProjectWritable(this.prisma, input.projectId);

    const maxOrder = await this.prisma.stockItem.aggregate({
      where: { projectId: input.projectId },
      _max: { order: true },
    });

    return this.prisma.stockItem.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        unit: input.unit ?? 'un',
        minQuantity: input.minQuantity ?? 0,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: {
        movements: true,
      },
    });
  }

  async update(input: UpdateStockItemInput) {
    const item = await ensureEntityAccess(
      this.prisma,
      input.id,
      input.instanceId,
      input.userId,
      () =>
        this.prisma.stockItem.findFirst({
          where: {
            id: input.id,
            project: { instanceId: input.instanceId },
          },
        }),
      () =>
        this.prisma.stockItem.findUnique({
          where: { id: input.id },
          include: { project: { select: { id: true } } },
        }),
    );

    await ensureProjectWritable(this.prisma, (item as any).projectId ?? (item as any).project?.id);

    const data: Record<string, any> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.minQuantity !== undefined) data.minQuantity = input.minQuantity;

    return this.prisma.stockItem.update({
      where: { id: input.id },
      data,
      include: {
        movements: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });
  }

  async remove(id: string, instanceId: string, userId?: string) {
    await ensureEntityAccess(
      this.prisma,
      id,
      instanceId,
      userId,
      () =>
        this.prisma.stockItem.findFirst({
          where: { id, project: { instanceId } },
        }),
      () =>
        this.prisma.stockItem.findUnique({
          where: { id },
          include: { project: { select: { id: true } } },
        }),
    );

    // Cascade delete handles movements
    return this.prisma.stockItem.delete({ where: { id } });
  }

  async addMovement(input: AddMovementInput) {
    const item = await ensureEntityAccess(
      this.prisma,
      input.stockItemId,
      input.instanceId,
      input.userId,
      () =>
        this.prisma.stockItem.findFirst({
          where: {
            id: input.stockItemId,
            project: { instanceId: input.instanceId },
          },
        }),
      () =>
        this.prisma.stockItem.findUnique({
          where: { id: input.stockItemId },
          include: { project: { select: { id: true } } },
        }),
    );

    await ensureProjectWritable(
      this.prisma,
      (item as any).projectId ?? (item as any).project?.id,
    );

    if (input.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    const delta = input.type === 'ENTRY' ? input.quantity : -input.quantity;

    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          stockItemId: input.stockItemId,
          type: input.type,
          quantity: input.quantity,
          responsible: input.responsible,
          notes: input.notes ?? '',
          date: input.date ? new Date(input.date) : new Date(),
        },
      });

      return tx.stockItem.update({
        where: { id: input.stockItemId },
        data: {
          currentQuantity: { increment: delta },
        },
        include: {
          movements: {
            orderBy: { date: 'desc' },
            take: 50,
          },
        },
      });
    });
  }

  async reorder(input: ReorderInput) {
    await ensureProjectAccess(
      this.prisma,
      input.projectId,
      input.instanceId,
      input.userId,
    );
    await ensureProjectWritable(this.prisma, input.projectId);

    await this.prisma.$transaction(
      input.items.map((item) =>
        this.prisma.stockItem.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );

    return { success: true };
  }
}
