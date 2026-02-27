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
  responsible?: string;
  notes?: string;
  date?: string;
}

interface UpdateMovementInput {
  movementId: string;
  instanceId: string;
  userId?: string;
  quantity?: number;
  responsible?: string;
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

  private get movementInclude() {
    return {
      createdBy: { select: { id: true, name: true, profileImage: true } },
    };
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await ensureProjectAccess(this.prisma, projectId, instanceId, userId);

    return this.prisma.stockItem.findMany({
      where: { projectId },
      include: {
        movements: {
          orderBy: { date: 'desc' },
          take: 10,
          include: this.movementInclude,
        },
      },
      orderBy: { order: 'asc' },
    });
  }

  async findMovements(
    stockItemId: string,
    instanceId: string,
    userId?: string,
    skip = 0,
    take = 10,
  ) {
    await ensureEntityAccess(
      this.prisma,
      stockItemId,
      instanceId,
      userId,
      () =>
        this.prisma.stockItem.findFirst({
          where: { id: stockItemId, project: { instanceId } },
        }),
      () =>
        this.prisma.stockItem.findUnique({
          where: { id: stockItemId },
          include: { project: { select: { id: true } } },
        }),
    );

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { stockItemId },
        orderBy: { date: 'desc' },
        skip,
        take,
        include: this.movementInclude,
      }),
      this.prisma.stockMovement.count({ where: { stockItemId } }),
    ]);

    return { movements, total };
  }

  async create(input: CreateStockItemInput) {
    await ensureProjectAccess(
      this.prisma,
      input.projectId,
      input.instanceId,
      input.userId,
    );
    await ensureProjectWritable(this.prisma, input.projectId);

    // Shift all existing items down so the new one lands at the top
    await this.prisma.stockItem.updateMany({
      where: { projectId: input.projectId },
      data: { order: { increment: 1 } },
    });

    return this.prisma.stockItem.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        unit: input.unit ?? 'un',
        minQuantity: input.minQuantity ?? 0,
        order: 0,
      },
      include: {
        movements: { include: this.movementInclude },
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

    const projectId =
      (item as { projectId: string }).projectId ??
      (item as { project?: { id: string } }).project?.id;

    await ensureProjectWritable(this.prisma, projectId);

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
          take: 10,
          include: this.movementInclude,
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

    const projectId =
      (item as { projectId: string }).projectId ??
      (item as { project?: { id: string } }).project?.id;

    await ensureProjectWritable(this.prisma, projectId);

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
          responsible:
            input.type === 'EXIT' ? (input.responsible ?? null) : null,
          createdById: input.type === 'ENTRY' ? input.userId : undefined,
          notes: input.notes ?? '',
          date: input.date
            ? new Date(
                input.date.includes('T') ? input.date : `${input.date}T12:00:00Z`,
              )
            : new Date(),
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
            take: 10,
            include: this.movementInclude,
          },
        },
      });
    });
  }

  async updateMovement(input: UpdateMovementInput) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id: input.movementId },
      include: {
        stockItem: {
          include: { project: { select: { id: true, instanceId: true } } },
        },
      },
    });

    if (!movement) {
      throw new BadRequestException('Movimentação não encontrada');
    }

    // Validate access
    const project = movement.stockItem.project;
    if (project.instanceId !== input.instanceId) {
      // Try membership fallback
      await ensureProjectAccess(
        this.prisma,
        project.id,
        input.instanceId,
        input.userId,
      );
    }
    await ensureProjectWritable(this.prisma, project.id);

    const newQuantity = input.quantity ?? movement.quantity;
    if (newQuantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    // Calculate delta reversal and new delta
    const oldDelta =
      movement.type === 'ENTRY' ? movement.quantity : -movement.quantity;
    const newDelta = movement.type === 'ENTRY' ? newQuantity : -newQuantity;
    const adjustment = newDelta - oldDelta;

    const data: Record<string, any> = {};
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.date !== undefined)
      data.date = new Date(
        input.date.includes('T') ? input.date : `${input.date}T12:00:00Z`,
      );
    if (movement.type === 'EXIT' && input.responsible !== undefined) {
      data.responsible = input.responsible;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.update({
        where: { id: input.movementId },
        data,
      });

      return tx.stockItem.update({
        where: { id: movement.stockItemId },
        data: {
          currentQuantity: { increment: adjustment },
        },
        include: {
          movements: {
            orderBy: { date: 'desc' },
            take: 10,
            include: this.movementInclude,
          },
        },
      });
    });
  }

  async deleteMovement(
    movementId: string,
    instanceId: string,
    userId?: string,
  ) {
    const movement = await this.prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        stockItem: {
          include: { project: { select: { id: true, instanceId: true } } },
        },
      },
    });

    if (!movement) {
      throw new BadRequestException('Movimentação não encontrada');
    }

    const project = movement.stockItem.project;
    if (project.instanceId !== instanceId) {
      await ensureProjectAccess(this.prisma, project.id, instanceId, userId);
    }
    await ensureProjectWritable(this.prisma, project.id);

    // Reverse the delta
    const reverseDelta =
      movement.type === 'ENTRY' ? -movement.quantity : movement.quantity;

    return this.prisma.$transaction(async (tx) => {
      await tx.stockMovement.delete({ where: { id: movementId } });

      return tx.stockItem.update({
        where: { id: movement.stockItemId },
        data: {
          currentQuantity: { increment: reverseDelta },
        },
        include: {
          movements: {
            orderBy: { date: 'desc' },
            take: 10,
            include: this.movementInclude,
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
