import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalStockService } from '../global-stock/global-stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ensureProjectAccess } from '../common/project-access.util';

interface CreateInput {
  instanceId: string;
  userId: string;
  projectId: string;
  globalStockItemId: string;
  quantity: number;
  notes?: string;
}

interface ApproveInput {
  id: string;
  instanceId: string;
  userId: string;
}

interface RejectInput {
  id: string;
  instanceId: string;
  userId: string;
  rejectionReason?: string;
}

interface DeliverInput {
  id: string;
  instanceId: string;
  userId: string;
  quantity: number;
  notes?: string;
  createPurchaseForRemaining?: boolean;
}

interface FindAllInput {
  instanceId: string;
  userId: string;
  projectId?: string;
  status?: string;
}

@Injectable()
export class StockRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly globalStockService: GlobalStockService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get requestInclude() {
    return {
      globalStockItem: {
        select: {
          id: true,
          name: true,
          unit: true,
          currentQuantity: true,
          status: true,
        },
      },
      project: { select: { id: true, name: true } },
      requestedBy: {
        select: { id: true, name: true, profileImage: true },
      },
      approvedBy: {
        select: { id: true, name: true, profileImage: true },
      },
      deliveries: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          createdBy: {
            select: { id: true, name: true, profileImage: true },
          },
        },
      },
      linkedPurchaseRequests: {
        select: {
          id: true,
          quantity: true,
          status: true,
          itemName: true,
        },
      },
    };
  }

  async findAll(input: FindAllInput) {
    const where: Prisma.StockRequestWhereInput = {
      instanceId: input.instanceId,
    };
    if (input.projectId) {
      where.projectId = input.projectId;
    }
    if (input.status) {
      where.status = input.status as Prisma.EnumStockRequestStatusFilter;
    }

    return this.prisma.stockRequest.findMany({
      where,
      include: this.requestInclude,
      orderBy: [
        { status: 'asc' }, // PENDING first
        { date: 'desc' },
      ],
    });
  }

  async create(input: CreateInput) {
    // Verify project access
    await ensureProjectAccess(
      this.prisma,
      input.projectId,
      input.instanceId,
      input.userId,
    );

    const item = await this.prisma.globalStockItem.findFirst({
      where: { id: input.globalStockItemId, instanceId: input.instanceId },
    });
    if (!item)
      throw new NotFoundException('Item não encontrado no estoque global');

    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: { name: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    if (input.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    const request = await this.prisma.stockRequest.create({
      data: {
        instanceId: input.instanceId,
        projectId: input.projectId,
        globalStockItemId: input.globalStockItemId,
        itemName: item.name,
        quantity: input.quantity,
        requestedById: input.userId,
        notes: input.notes ?? null,
      },
      include: this.requestInclude,
    });

    // Notify warehouse users
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        projectId: input.projectId,
        category: 'STOCK',
        eventType: 'stock_requested',
        title: `Requisição de material: ${item.name}`,
        body: `Obra "${project.name}" solicitou ${input.quantity} ${item.unit} de "${item.name}"`,
        actorUserId: input.userId,
        permissionCodes: [
          'global_stock_warehouse.view',
          'global_stock_warehouse.edit',
        ],
      })
      .catch(() => {});

    return request;
  }

  async approve(input: ApproveInput) {
    const request = await this.prisma.stockRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: {
        requestedBy: { select: { id: true } },
      },
    });
    if (!request) throw new NotFoundException('Requisição não encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Somente requisições pendentes podem ser aprovadas',
      );
    }

    // Update request status — stock debit happens on deliver()
    const updated = await this.prisma.stockRequest.update({
      where: { id: input.id },
      data: {
        status: 'APPROVED',
        approvedById: input.userId,
        approvedAt: new Date(),
      },
      include: this.requestInclude,
    });

    // Notify the requester
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        projectId: request.projectId,
        category: 'STOCK',
        eventType: 'stock_request_approved',
        title: `Requisição aprovada: ${request.itemName}`,
        body: `Sua requisição de ${request.quantity} de "${request.itemName}" foi aprovada e aguarda envio`,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
      })
      .catch(() => {});

    return updated;
  }

  /**
   * Deliver material (partial or full) for an approved stock request.
   * Creates a StockRequestDelivery record, debits global stock,
   * and optionally creates a PurchaseRequest for the remaining quantity.
   */
  async deliver(input: DeliverInput) {
    const request = await this.prisma.stockRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: {
        globalStockItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            currentQuantity: true,
            instanceId: true,
          },
        },
        project: { select: { id: true, name: true } },
        requestedBy: { select: { id: true } },
      },
    });
    if (!request) throw new NotFoundException('Requisição não encontrada');

    // Only allow deliveries on APPROVED or PARTIALLY_DELIVERED requests
    if (
      request.status !== 'APPROVED' &&
      request.status !== 'PARTIALLY_DELIVERED'
    ) {
      throw new BadRequestException(
        'Somente requisições aprovadas ou parcialmente entregues podem receber envios',
      );
    }

    if (input.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero');
    }

    const remaining =
      Math.round((request.quantity - request.quantityDelivered) * 10000) /
      10000;
    if (input.quantity > remaining) {
      throw new BadRequestException(
        `Quantidade excede o restante da solicitação. Faltam: ${remaining} ${request.globalStockItem.unit}`,
      );
    }

    // Check stock availability
    if (input.quantity > request.globalStockItem.currentQuantity) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${request.globalStockItem.currentQuantity} ${request.globalStockItem.unit}`,
      );
    }

    const newDelivered =
      Math.round((request.quantityDelivered + input.quantity) * 10000) / 10000;
    const isFullyDelivered = newDelivered >= request.quantity;

    // Debit global stock
    await this.globalStockService.addExitFromRequest({
      globalStockItemId: request.globalStockItemId,
      instanceId: input.instanceId,
      userId: input.userId,
      quantity: input.quantity,
      projectId: request.projectId,
      projectName: request.project.name,
    });

    // Create delivery record and update request
    await this.prisma.$transaction([
      this.prisma.stockRequestDelivery.create({
        data: {
          stockRequestId: input.id,
          quantity: input.quantity,
          notes: input.notes ?? null,
          createdById: input.userId,
        },
      }),
      this.prisma.stockRequest.update({
        where: { id: input.id },
        data: {
          quantityDelivered: newDelivered,
          status: isFullyDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED',
        },
      }),
    ]);

    const remainingAfter =
      Math.round((request.quantity - newDelivered) * 10000) / 10000;

    // Optionally create a purchase request for the remaining quantity
    if (
      input.createPurchaseForRemaining &&
      !isFullyDelivered &&
      remainingAfter > 0
    ) {
      // Reload item to get fresh currentQuantity after EXIT
      const freshItem = await this.prisma.globalStockItem.findUnique({
        where: { id: request.globalStockItemId },
        select: { currentQuantity: true },
      });

      await this.prisma.purchaseRequest.create({
        data: {
          instanceId: input.instanceId,
          globalStockItemId: request.globalStockItemId,
          itemName: request.itemName,
          quantity: remainingAfter,
          requestedById: input.userId,
          stockRequestId: request.id,
          priority:
            freshItem && freshItem.currentQuantity <= 0 ? 'HIGH' : 'MEDIUM',
          notes: `Compra para suprir requisição de "${request.project.name}" — faltam ${remainingAfter} ${request.globalStockItem.unit}`,
        },
      });

      // Notify financial
      this.notificationsService
        .emit({
          instanceId: input.instanceId,
          category: 'STOCK',
          eventType: 'purchase_requested',
          title: `Solicitação de compra: ${request.itemName}`,
          body: `${remainingAfter} ${request.globalStockItem.unit} de "${request.itemName}" para obra "${request.project.name}"`,
          priority:
            freshItem && freshItem.currentQuantity <= 0 ? 'high' : 'normal',
          actorUserId: input.userId,
          permissionCodes: [
            'global_stock_financial.view',
            'global_stock_financial.edit',
          ],
        })
        .catch(() => {});
    }

    // Notify requester about delivery
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        projectId: request.projectId,
        category: 'STOCK',
        eventType: isFullyDelivered
          ? 'stock_request_delivered'
          : 'stock_request_partial_delivery',
        title: isFullyDelivered
          ? `Material entregue: ${request.itemName}`
          : `Envio parcial: ${request.itemName}`,
        body: isFullyDelivered
          ? `Todos os ${request.quantity} ${request.globalStockItem.unit} de "${request.itemName}" foram entregues para "${request.project.name}"`
          : `Entregues ${input.quantity} de ${request.quantity} ${request.globalStockItem.unit} de "${request.itemName}". Faltam: ${remainingAfter} ${request.globalStockItem.unit}`,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
      })
      .catch(() => {});

    // Return updated request with all includes
    return this.prisma.stockRequest.findUnique({
      where: { id: input.id },
      include: this.requestInclude,
    });
  }

  /**
   * List deliveries for a stock request
   */
  async findDeliveries(stockRequestId: string, instanceId: string) {
    const request = await this.prisma.stockRequest.findFirst({
      where: { id: stockRequestId, instanceId },
    });
    if (!request) throw new NotFoundException('Requisição não encontrada');

    return this.prisma.stockRequestDelivery.findMany({
      where: { stockRequestId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true, profileImage: true },
        },
      },
    });
  }

  async reject(input: RejectInput) {
    const request = await this.prisma.stockRequest.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: {
        requestedBy: { select: { id: true } },
      },
    });
    if (!request) throw new NotFoundException('Requisição não encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Somente requisições pendentes podem ser rejeitadas',
      );
    }

    const updated = await this.prisma.stockRequest.update({
      where: { id: input.id },
      data: {
        status: 'REJECTED',
        approvedById: input.userId,
        approvedAt: new Date(),
        rejectionReason: input.rejectionReason ?? null,
      },
      include: this.requestInclude,
    });

    // Notify the requester
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        projectId: request.projectId,
        category: 'STOCK',
        eventType: 'stock_request_rejected',
        title: `Material rejeitado: ${request.itemName}`,
        body: input.rejectionReason
          ? `Requisição de "${request.itemName}" rejeitada: ${input.rejectionReason}`
          : `Sua requisição de "${request.itemName}" foi rejeitada`,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
      })
      .catch(() => {});

    return updated;
  }
}
