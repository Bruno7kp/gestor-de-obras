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
        globalStockItem: true,
        project: { select: { id: true, name: true } },
        requestedBy: { select: { id: true } },
      },
    });
    if (!request) throw new NotFoundException('Requisição não encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        'Somente requisições pendentes podem ser aprovadas',
      );
    }

    // Check stock availability
    if (request.globalStockItem.currentQuantity < request.quantity) {
      throw new BadRequestException(
        `Estoque insuficiente. Disponível: ${request.globalStockItem.currentQuantity} ${request.globalStockItem.unit}`,
      );
    }

    // Update request status
    const updated = await this.prisma.stockRequest.update({
      where: { id: input.id },
      data: {
        status: 'APPROVED',
        approvedById: input.userId,
        approvedAt: new Date(),
      },
      include: this.requestInclude,
    });

    // Create EXIT movement in global stock
    await this.globalStockService.addExitFromRequest({
      globalStockItemId: request.globalStockItemId,
      instanceId: input.instanceId,
      userId: input.userId,
      quantity: request.quantity,
      projectId: request.projectId,
      projectName: request.project.name,
    });

    // Notify the requester
    this.notificationsService
      .emit({
        instanceId: input.instanceId,
        projectId: request.projectId,
        category: 'STOCK',
        eventType: 'stock_request_approved',
        title: `Material aprovado: ${request.itemName}`,
        body: `Sua requisição de ${request.quantity} de "${request.itemName}" foi aprovada`,
        actorUserId: input.userId,
        specificUserIds: [request.requestedById],
      })
      .catch(() => {});

    return updated;
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
