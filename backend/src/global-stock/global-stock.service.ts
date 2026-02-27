import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  GlobalStockStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';

// --- DTOs ---

interface CreateGlobalStockItemInput {
  instanceId: string;
  name: string;
  unit?: string;
  minQuantity?: number;
  supplierId?: string;
}

interface UpdateGlobalStockItemInput {
  id: string;
  instanceId: string;
  name?: string;
  unit?: string;
  minQuantity?: number;
  supplierId?: string | null;
}

interface AddGlobalMovementInput {
  globalStockItemId: string;
  instanceId: string;
  userId: string;
  type: 'ENTRY' | 'EXIT';
  quantity: number;
  unitPrice?: number;
  responsible?: string;
  originDestination?: string;
  projectId?: string;
  invoiceNumber?: string;
  supplierId?: string;
  notes?: string;
  date?: string;
}

interface FindAllMovementsInput {
  instanceId: string;
  skip?: number;
  take?: number;
  projectId?: string;
}

interface FindItemMovementsInput {
  globalStockItemId: string;
  instanceId: string;
  skip?: number;
  take?: number;
}

@Injectable()
export class GlobalStockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get itemInclude() {
    return {
      supplier: { select: { id: true, name: true } },
      priceHistory: {
        orderBy: { date: 'desc' as const },
        take: 5,
        include: {
          supplier: { select: { id: true, name: true } },
        },
      },
    };
  }

  private get movementInclude() {
    return {
      createdBy: { select: { id: true, name: true, profileImage: true } },
      project: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      globalStockItem: { select: { id: true, name: true, unit: true } },
    };
  }

  /**
   * Compute the status based on current stock levels
   */
  private computeStatus(
    currentQuantity: number,
    minQuantity: number,
  ): GlobalStockStatus {
    if (currentQuantity <= 0) return 'OUT_OF_STOCK';
    if (currentQuantity <= minQuantity) return 'CRITICAL';
    return 'NORMAL';
  }

  /**
   * Parse a date string into a Date object
   */
  private parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();
    return new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00Z`);
  }

  // ===== CRUD =====

  async findAll(instanceId: string) {
    return this.prisma.globalStockItem.findMany({
      where: { instanceId },
      include: this.itemInclude,
      orderBy: { order: 'asc' },
    });
  }

  async create(input: CreateGlobalStockItemInput) {
    // Shift existing items' order down
    await this.prisma.globalStockItem.updateMany({
      where: { instanceId: input.instanceId },
      data: { order: { increment: 1 } },
    });

    return this.prisma.globalStockItem.create({
      data: {
        instanceId: input.instanceId,
        name: input.name,
        unit: input.unit ?? 'un',
        minQuantity: input.minQuantity ?? 0,
        supplierId: input.supplierId ?? null,
        order: 0,
      },
      include: this.itemInclude,
    });
  }

  async update(input: UpdateGlobalStockItemInput) {
    const item = await this.prisma.globalStockItem.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    const data: Prisma.GlobalStockItemUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.minQuantity !== undefined) {
      data.minQuantity = input.minQuantity;
      // Recalculate status with new min
      data.status = this.computeStatus(item.currentQuantity, input.minQuantity);
    }
    if (input.supplierId !== undefined) {
      data.supplier = input.supplierId
        ? { connect: { id: input.supplierId } }
        : { disconnect: true };
    }

    return this.prisma.globalStockItem.update({
      where: { id: input.id },
      data,
      include: this.itemInclude,
    });
  }

  async remove(id: string, instanceId: string) {
    const item = await this.prisma.globalStockItem.findFirst({
      where: { id, instanceId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    return this.prisma.globalStockItem.delete({ where: { id } });
  }

  async reorder(
    instanceId: string,
    items: Array<{ id: string; order: number }>,
  ) {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.globalStockItem.update({
          where: { id: item.id },
          data: { order: item.order },
        }),
      ),
    );
    return { success: true };
  }

  // ===== MOVEMENTS =====

  async addMovement(input: AddGlobalMovementInput) {
    const item = await this.prisma.globalStockItem.findFirst({
      where: { id: input.globalStockItemId, instanceId: input.instanceId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    if (input.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    if (input.type === 'EXIT' && item.currentQuantity < input.quantity) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${item.currentQuantity} ${item.unit}`,
      );
    }

    const delta = input.type === 'ENTRY' ? input.quantity : -input.quantity;
    const movementDate = this.parseDate(input.date);

    return this.prisma.$transaction(async (tx) => {
      // Create movement record
      await tx.globalStockMovement.create({
        data: {
          globalStockItemId: input.globalStockItemId,
          type: input.type as StockMovementType,
          quantity: input.quantity,
          unitPrice: input.unitPrice ?? null,
          date: movementDate,
          responsible: input.responsible ?? null,
          originDestination: input.originDestination ?? 'Depósito Central',
          projectId: input.projectId ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          supplierId: input.supplierId ?? null,
          notes: input.notes ?? '',
          createdById: input.userId,
        },
      });

      // For ENTRY with price, update average price + price history
      let priceUpdate: Prisma.GlobalStockItemUpdateInput = {};
      if (input.type === 'ENTRY' && input.unitPrice && input.unitPrice > 0) {
        const newQty = item.currentQuantity + input.quantity;
        const weightedAvg =
          newQty > 0
            ? (item.currentQuantity * item.averagePrice +
                input.quantity * input.unitPrice) /
              newQty
            : input.unitPrice;

        // Round to 4 decimal places for precision
        priceUpdate = {
          averagePrice: Math.round(weightedAvg * 10000) / 10000,
          lastPrice: input.unitPrice,
          lastEntryDate: movementDate,
        };

        // Create price history entry
        await tx.priceHistory.create({
          data: {
            globalStockItemId: input.globalStockItemId,
            date: movementDate,
            price: input.unitPrice,
            supplierId: input.supplierId ?? null,
          },
        });
      }

      const newQuantity = item.currentQuantity + delta;
      const newStatus = this.computeStatus(newQuantity, item.minQuantity);

      const updated = await tx.globalStockItem.update({
        where: { id: input.globalStockItemId },
        data: {
          currentQuantity: { increment: delta },
          status: newStatus,
          ...priceUpdate,
        },
        include: this.itemInclude,
      });

      // Emit notification if item became critical or out of stock
      if (newStatus !== 'NORMAL' && item.status === 'NORMAL') {
        this.notificationsService
          .emit({
            instanceId: input.instanceId,
            category: 'STOCK',
            eventType:
              newStatus === 'OUT_OF_STOCK'
                ? 'stock_depleted'
                : 'stock_critical',
            title:
              newStatus === 'OUT_OF_STOCK'
                ? `Estoque zerado: ${item.name}`
                : `Estoque crítico: ${item.name}`,
            body: `O item "${item.name}" está com ${newQuantity} ${item.unit} (mínimo: ${item.minQuantity})`,
            priority: newStatus === 'OUT_OF_STOCK' ? 'high' : 'normal',
            actorUserId: input.userId,
            permissionCodes: [
              'global_stock_warehouse.view',
              'global_stock_warehouse.edit',
            ],
          })
          .catch(() => {});
      }

      return updated;
    });
  }

  /**
   * Entry specifically from a completed purchase request.
   * Called by PurchaseRequestService when completing a purchase.
   */
  async addEntryFromPurchase(params: {
    globalStockItemId: string;
    instanceId: string;
    userId: string;
    quantity: number;
    unitPrice: number;
    invoiceNumber?: string;
    supplierId?: string;
  }) {
    return this.addMovement({
      globalStockItemId: params.globalStockItemId,
      instanceId: params.instanceId,
      userId: params.userId,
      type: 'ENTRY',
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      invoiceNumber: params.invoiceNumber,
      supplierId: params.supplierId,
      originDestination: 'Compra - NF',
      notes: params.invoiceNumber
        ? `Entrada via compra - NF: ${params.invoiceNumber}`
        : 'Entrada via compra',
    });
  }

  /**
   * Exit specifically from an approved stock request.
   * Called by StockRequestService when approving a request.
   */
  async addExitFromRequest(params: {
    globalStockItemId: string;
    instanceId: string;
    userId: string;
    quantity: number;
    projectId: string;
    projectName: string;
  }) {
    return this.addMovement({
      globalStockItemId: params.globalStockItemId,
      instanceId: params.instanceId,
      userId: params.userId,
      type: 'EXIT',
      quantity: params.quantity,
      projectId: params.projectId,
      originDestination: params.projectName,
      notes: `Saída para obra: ${params.projectName}`,
    });
  }

  // ===== MOVEMENT QUERIES =====

  async findAllMovements(input: FindAllMovementsInput) {
    const where: Prisma.GlobalStockMovementWhereInput = {
      // Filter by instance through the global stock item
      globalStockItem: { instanceId: input.instanceId },
      ...(input.projectId ? { projectId: input.projectId } : {}),
    };

    const [movements, total] = await Promise.all([
      this.prisma.globalStockMovement.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: input.skip ?? 0,
        take: input.take ?? 50,
        include: this.movementInclude,
      }),
      this.prisma.globalStockMovement.count({ where }),
    ]);

    return { movements, total };
  }

  async findItemMovements(input: FindItemMovementsInput) {
    const item = await this.prisma.globalStockItem.findFirst({
      where: { id: input.globalStockItemId, instanceId: input.instanceId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    const [movements, total] = await Promise.all([
      this.prisma.globalStockMovement.findMany({
        where: { globalStockItemId: input.globalStockItemId },
        orderBy: { date: 'desc' },
        skip: input.skip ?? 0,
        take: input.take ?? 20,
        include: this.movementInclude,
      }),
      this.prisma.globalStockMovement.count({
        where: { globalStockItemId: input.globalStockItemId },
      }),
    ]);

    return { movements, total };
  }

  // ===== DASHBOARD HELPERS =====

  async getKpis(instanceId: string) {
    const items = await this.prisma.globalStockItem.findMany({
      where: { instanceId },
      select: {
        currentQuantity: true,
        averagePrice: true,
        status: true,
      },
    });

    const totalItems = items.length;
    const criticalItems = items.filter(
      (i) => i.status === 'CRITICAL' || i.status === 'OUT_OF_STOCK',
    ).length;
    const totalValue = items.reduce(
      (sum, i) => sum + i.currentQuantity * i.averagePrice,
      0,
    );

    return { totalItems, criticalItems, totalValue };
  }
}
