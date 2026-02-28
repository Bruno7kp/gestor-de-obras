import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalStockService } from '../global-stock/global-stock.service';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateInput {
  instanceId: string;
  userId: string;
  globalStockItemId: string;
  quantity: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  notes?: string;
  stockRequestId?: string;
}

interface MarkOrderedInput {
  id: string;
  instanceId: string;
  userId: string;
}

interface CompleteInput {
  id: string;
  instanceId: string;
  userId: string;
  invoiceNumber?: string;
  unitPrice: number;
  supplierId?: string;
}

interface CancelInput {
  id: string;
  instanceId: string;
  userId: string;
}

@Injectable()
export class PurchaseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly globalStockService: GlobalStockService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get requestInclude() {
    return {
      globalStockItem: {
        select: { id: true, name: true, unit: true, currentQuantity: true },
      },
      requestedBy: {
        select: { id: true, name: true, profileImage: true },
      },
      processedBy: {
        select: { id: true, name: true, profileImage: true },
      },
      stockRequest: {
        select: {
          id: true,
          projectId: true,
          quantity: true,
          quantityDelivered: true,
          project: { select: { id: true, name: true } },
        },
      },
    };
  }

  async findAll(instanceId: string, status?: string) {
    const where: Prisma.PurchaseRequestWhereInput = { instanceId };
    if (status) {
      where.status = status as Prisma.EnumPurchaseRequestStatusFilter;
    }

    return this.prisma.purchaseRequest.findMany({
      where,
      include: this.requestInclude,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { priority: 'desc' }, // HIGH priority first
        { date: 'desc' },
      ],
    });
  }

  async create(input: CreateInput) {
    const item = await this.prisma.globalStockItem.findFirst({
      where: { id: input.globalStockItemId, instanceId: input.instanceId },
    });
    if (!item)
      throw new NotFoundException('Item não encontrado no estoque global');

    if (input.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    // Auto-set high priority if completely out of stock
    const priority =
      input.priority ?? (item.currentQuantity <= 0 ? 'HIGH' : 'MEDIUM');

    const request = await this.prisma.purchaseRequest.create({
      data: {
        instanceId: input.instanceId,
        globalStockItemId: input.globalStockItemId,
        itemName: item.name,
        quantity: input.quantity,
        requestedById: input.userId,
        priority,
        notes: input.notes ?? null,
        stockRequestId: input.stockRequestId ?? null,
      },
      include: this.requestInclude,
    });

    // Notify financial users
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        category: 'STOCK',
        eventType: 'purchase_requested',
        title: `Solicitação de compra: ${item.name}`,
        body: `${input.quantity} ${item.unit} de "${item.name}" solicitados para compra`,
        priority: priority === 'HIGH' ? 'high' : 'normal',
        actorUserId: input.userId,
        permissionCodes: [
          'global_stock_financial.view',
          'global_stock_financial.edit',
        ],
      })
      .catch(() => {});

    return request;
  }

  async markOrdered(input: MarkOrderedInput) {
    const request = await this.prisma.purchaseRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: { requestedBy: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Somente solicitações pendentes podem ser marcadas como pedido feito',
      );
    }

    const updated = await this.prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: 'ORDERED',
        processedById: input.userId,
        orderedAt: new Date(),
      },
      include: this.requestInclude,
    });

    // Notify the requester
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        category: 'STOCK',
        eventType: 'purchase_ordered',
        title: `Pedido de compra realizado: ${request.itemName}`,
        body: `O pedido de ${request.quantity} de "${request.itemName}" foi feito ao fornecedor`,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
      })
      .catch(() => {});

    return updated;
  }

  async complete(input: CompleteInput) {
    const request = await this.prisma.purchaseRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: {
        requestedBy: { select: { id: true } },
        stockRequest: {
          select: {
            id: true,
            projectId: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status !== 'ORDERED') {
      throw new BadRequestException(
        'Somente solicitações com pedido feito podem ser concluídas',
      );
    }

    if (input.unitPrice <= 0) {
      throw new BadRequestException('Preço unitário deve ser maior que zero');
    }

    // Update the purchase request
    const updated = await this.prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        invoiceNumber: input.invoiceNumber ?? null,
        unitPrice: input.unitPrice,
        processedById: input.userId,
      },
      include: this.requestInclude,
    });

    // Automatically create an ENTRY in global stock
    await this.globalStockService.addEntryFromPurchase({
      globalStockItemId: request.globalStockItemId,
      instanceId: input.instanceId,
      userId: input.userId,
      quantity: request.quantity,
      unitPrice: input.unitPrice,
      invoiceNumber: input.invoiceNumber,
      supplierId: input.supplierId,
    });

    // Notify financial users + requester + warehouse (if linked to stock request)
    const notifBody = request.stockRequest
      ? `${request.quantity} de "${request.itemName}" disponíveis — requisição de "${request.stockRequest.project.name}" aguarda envio`
      : `${request.quantity} de "${request.itemName}" entregues e registrados no estoque`;

    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        category: 'STOCK',
        eventType: 'purchase_completed',
        title: `Material recebido: ${request.itemName}`,
        body: notifBody,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
        permissionCodes: [
          'global_stock_financial.view',
          'global_stock_financial.edit',
          'global_stock_warehouse.view',
          'global_stock_warehouse.edit',
        ],
      })
      .catch(() => {});

    return updated;
  }

  async cancel(input: CancelInput) {
    const request = await this.prisma.purchaseRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw new BadRequestException('Solicitação já finalizada');
    }

    return this.prisma.purchaseRequest.update({
      where: { id: input.id },
      data: {
        status: 'CANCELLED',
        processedById: input.userId,
      },
      include: this.requestInclude,
    });
  }
}
