import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';
import {
  ensureProjectAccess,
  ensureProjectWritable,
} from '../common/project-access.util';
import { NotificationsService } from '../notifications/notifications.service';

interface LaborPaymentInput {
  id?: string;
  data: string;
  valor: number;
  descricao: string;
  comprovante?: string | null;
  createdById?: string | null;
}

interface CreateLaborContractInput {
  projectId: string;
  instanceId: string;
  userId?: string;
  tipo: string;
  descricao: string;
  associadoId: string;
  valorTotal: number;
  dataInicio: string;
  dataFim?: string;
  linkedWorkItemId?: string;
  linkedWorkItemIds?: string[];
  observacoes?: string;
  ordem?: number;
  pagamentos?: LaborPaymentInput[];
}

interface UpdateLaborContractInput extends Partial<CreateLaborContractInput> {
  id: string;
  instanceId: string;
  userId?: string;
}

@Injectable()
export class LaborContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async emitLaborContractCreatedNotification(
    instanceId: string,
    contract: {
      id: string;
      projectId: string;
      descricao: string;
      valorTotal: number;
      associadoId: string;
    },
    actorUserId?: string,
  ) {
    await this.notificationsService.emit({
      instanceId,
      projectId: contract.projectId,
      actorUserId,
      category: 'WORKFORCE',
      eventType: 'LABOR_CONTRACT_CREATED',
      priority: 'normal',
      title: 'Contrato de Mão de Obra Criado',
      body: `Novo contrato registrado: ${contract.descricao}. Valor total: R$ ${contract.valorTotal.toFixed(2)}.`,
      dedupeKey: `labor-contract:${contract.id}:CREATED`,
      permissionCodes: ['workforce.view', 'workforce.edit'],
      includeProjectMembers: true,
      metadata: {
        contractId: contract.id,
        associadoId: contract.associadoId,
      },
    });
  }

  private async emitLaborContractStatusChangedNotification(
    instanceId: string,
    contract: {
      id: string;
      projectId: string;
      descricao: string;
      status: string;
      valorPago: number;
      valorTotal: number;
    },
    previousStatus: string,
    actorUserId?: string,
  ) {
    if (previousStatus === contract.status) return;

    await this.notificationsService.emit({
      instanceId,
      projectId: contract.projectId,
      actorUserId,
      category: 'WORKFORCE',
      eventType: 'LABOR_CONTRACT_STATUS_CHANGED',
      priority: contract.status === 'pago' ? 'high' : 'normal',
      title: 'Atualização de Contrato de Mão de Obra',
      body: `Contrato ${contract.descricao} alterado de ${previousStatus} para ${contract.status}. Pago: R$ ${contract.valorPago.toFixed(2)} de R$ ${contract.valorTotal.toFixed(2)}.`,
      dedupeKey: `labor-contract:${contract.id}:STATUS:${contract.status}`,
      permissionCodes: ['workforce.view', 'workforce.edit'],
      includeProjectMembers: true,
      metadata: {
        contractId: contract.id,
        previousStatus,
        status: contract.status,
        valorPago: contract.valorPago,
      },
    });
  }

  private async emitLaborPaymentRecordedNotification(
    instanceId: string,
    contract: {
      id: string;
      projectId: string;
      descricao: string;
    },
    payment: {
      id: string;
      valor: number;
      data: string;
    },
    actorUserId?: string,
  ) {
    await this.notificationsService.emit({
      instanceId,
      projectId: contract.projectId,
      actorUserId,
      category: 'WORKFORCE',
      eventType: 'LABOR_PAYMENT_RECORDED',
      priority: 'high',
      title: 'Pagamento de Mão de Obra Registrado',
      body: `Pagamento registrado para ${contract.descricao}: R$ ${payment.valor.toFixed(2)} em ${payment.data}.`,
      dedupeKey: `labor-payment:${payment.id}:RECORDED`,
      permissionCodes: ['workforce.view', 'workforce.edit'],
      includeProjectMembers: true,
      metadata: {
        contractId: contract.id,
        paymentId: payment.id,
        paymentDate: payment.data,
      },
    });
  }

  private normalizeOrder(value?: number) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Math.floor(value as number);
    if (normalized > 2147483647) {
      return Math.floor(normalized / 1000);
    }
    if (normalized < -2147483648) return 0;
    return normalized;
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

  private async ensureWorkforceMember(id: string, projectId: string) {
    const member = await this.prisma.workforceMember.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Associado nao encontrado');
  }

  private async ensureWorkItem(id: string, projectId: string) {
    const item = await this.prisma.workItem.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Item da EAP nao encontrado');
  }

  private async ensureWorkItems(ids: string[], projectId: string) {
    await Promise.all(ids.map((id) => this.ensureWorkItem(id, projectId)));
  }

  private normalizeLinkedWorkItemIds(linkedWorkItemIds?: string[], linkedWorkItemId?: string) {
    const ids = linkedWorkItemIds ?? (linkedWorkItemId ? [linkedWorkItemId] : []);
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private resolveLinkedWorkItemIds(input: {
    linkedWorkItemIds?: string[];
    linkedWorkItemId?: string;
  }): string[] | undefined {
    if (input.linkedWorkItemIds !== undefined) {
      return this.normalizeLinkedWorkItemIds(input.linkedWorkItemIds, undefined);
    }
    if (input.linkedWorkItemId !== undefined) {
      return this.normalizeLinkedWorkItemIds(undefined, input.linkedWorkItemId);
    }
    return undefined;
  }

  private getPaymentTotals(pagamentos: LaborPaymentInput[], valorTotal: number) {
    const valorPago = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
    const status = valorPago === 0 ? 'pendente' : valorPago >= valorTotal ? 'pago' : 'parcial';
    return { valorPago, status };
  }

  async findAll(projectId: string, instanceId: string, userId?: string) {
    await this.ensureProject(projectId, instanceId, userId);
    return this.prisma.laborContract.findMany({
      where: { projectId },
      orderBy: { ordem: 'asc' },
      include: {
        pagamentos: {
          orderBy: { data: 'asc' },
          include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
        },
        linkedWorkItems: { select: { workItemId: true } },
      },
    });
  }

  async create(input: CreateLaborContractInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId, true);
    await this.ensureWorkforceMember(input.associadoId, input.projectId);
    const linkedWorkItemIds = this.normalizeLinkedWorkItemIds(
      input.linkedWorkItemIds,
      input.linkedWorkItemId,
    );
    if (linkedWorkItemIds.length) {
      await this.ensureWorkItems(linkedWorkItemIds, input.projectId);
    }

    const pagamentos = input.pagamentos ?? [];
    const totals = this.getPaymentTotals(pagamentos, input.valorTotal);
    const normalizedOrder = this.normalizeOrder(input.ordem);

    const created = await this.prisma.$transaction(async prisma => {
      const contract = await prisma.laborContract.create({
        data: {
          projectId: input.projectId,
          tipo: input.tipo,
          descricao: input.descricao,
          associadoId: input.associadoId,
          valorTotal: input.valorTotal,
          valorPago: totals.valorPago,
          status: totals.status,
          dataInicio: input.dataInicio,
          dataFim: input.dataFim || null,
          linkedWorkItemId: linkedWorkItemIds[0] || null,
          observacoes: input.observacoes || null,
          ordem: normalizedOrder,
        },
      });

      if (linkedWorkItemIds.length) {
        await prisma.laborContractWorkItem.createMany({
          data: linkedWorkItemIds.map((workItemId) => ({
            laborContractId: contract.id,
            workItemId,
          })),
          skipDuplicates: true,
        });
      }

      if (pagamentos.length) {
        await prisma.laborPayment.createMany({
          data: pagamentos.map(p => ({
              id: p.id,
            data: p.data,
            valor: p.valor,
            descricao: p.descricao,
            comprovante: p.comprovante || null,
            laborContractId: contract.id,
              createdById: p.createdById ?? input.userId ?? null,
          })),
        });
      }

      return prisma.laborContract.findUnique({
        where: { id: contract.id },
        include: {
          pagamentos: {
            orderBy: { data: 'asc' },
            include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
          },
          linkedWorkItems: { select: { workItemId: true } },
        },
      });
    });

    if (created) {
      await this.emitLaborContractCreatedNotification(input.instanceId, {
        id: created.id,
        projectId: created.projectId,
        descricao: created.descricao,
        valorTotal: created.valorTotal,
        associadoId: created.associadoId,
      }, input.userId);
    }

    return created;
  }

  async update(input: UpdateLaborContractInput) {
    let existing = await this.prisma.laborContract.findFirst({
      where: { id: input.id, project: { instanceId: input.instanceId } },
    });
    if (!existing && input.userId) {
      existing = await this.prisma.laborContract.findFirst({
        where: { id: input.id, project: { members: { some: { userId: input.userId } } } },
      });
    }

    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    if (input.associadoId) {
      await this.ensureWorkforceMember(input.associadoId, existing.projectId);
    }

    const linkedWorkItemIds = this.resolveLinkedWorkItemIds(input);
    if (linkedWorkItemIds && linkedWorkItemIds.length) {
      await this.ensureWorkItems(linkedWorkItemIds, existing.projectId);
    }

    const pagamentos = input.pagamentos;
    const valorTotal = input.valorTotal ?? existing.valorTotal;
    const totals = pagamentos ? this.getPaymentTotals(pagamentos, valorTotal) : null;
    const normalizedOrder = this.normalizeOrder(input.ordem ?? existing.ordem);
    const nextLinkedWorkItemId = linkedWorkItemIds
      ? linkedWorkItemIds[0] || null
      : existing.linkedWorkItemId;

    const previousStatus = existing.status;

    const updated = await this.prisma.$transaction(async prisma => {
      const updated = await prisma.laborContract.update({
        where: { id: existing.id },
        data: {
          tipo: input.tipo ?? existing.tipo,
          descricao: input.descricao ?? existing.descricao,
          associadoId: input.associadoId ?? existing.associadoId,
          valorTotal,
          valorPago: totals ? totals.valorPago : existing.valorPago,
          status: totals ? totals.status : existing.status,
          dataInicio: input.dataInicio ?? existing.dataInicio,
          dataFim: input.dataFim ?? existing.dataFim,
          linkedWorkItemId: nextLinkedWorkItemId,
          observacoes: input.observacoes ?? existing.observacoes,
          ordem: normalizedOrder,
        },
      });

      if (linkedWorkItemIds !== undefined) {
        await prisma.laborContractWorkItem.deleteMany({
          where: { laborContractId: updated.id },
        });

        if (linkedWorkItemIds.length) {
          await prisma.laborContractWorkItem.createMany({
            data: linkedWorkItemIds.map((workItemId) => ({
              laborContractId: updated.id,
              workItemId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (pagamentos) {
        const existingPayments = await prisma.laborPayment.findMany({
          where: { laborContractId: updated.id },
          select: { id: true, createdById: true },
        });
        const createdByMap = new Map(existingPayments.map(p => [p.id, p.createdById] as const));

        await prisma.laborPayment.deleteMany({
          where: { laborContractId: updated.id },
        });

        if (pagamentos.length) {
          await prisma.laborPayment.createMany({
            data: pagamentos.map(p => {
              const paymentId = p.id ?? null;
              const existingCreatedById = paymentId ? createdByMap.get(paymentId) : null;
              return {
                id: p.id,
                data: p.data,
                valor: p.valor,
                descricao: p.descricao,
                comprovante: p.comprovante || null,
                laborContractId: updated.id,
                createdById: existingCreatedById ?? p.createdById ?? input.userId ?? null,
              };
            }),
          });
        }
      }

      return prisma.laborContract.findUnique({
        where: { id: updated.id },
        include: {
          pagamentos: {
            orderBy: { data: 'asc' },
            include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
          },
          linkedWorkItems: { select: { workItemId: true } },
        },
      });
    });

    if (updated) {
      await this.emitLaborContractStatusChangedNotification(
        input.instanceId,
        {
          id: updated.id,
          projectId: updated.projectId,
          descricao: updated.descricao,
          status: updated.status,
          valorPago: updated.valorPago,
          valorTotal: updated.valorTotal,
        },
        previousStatus,
        input.userId,
      );
    }

    return updated;
  }

  async upsertPayment(
    contractId: string,
    payment: LaborPaymentInput,
    instanceId: string,
    userId?: string,
  ) {
    let existing = await this.prisma.laborContract.findFirst({
      where: { id: contractId, project: { instanceId } },
    });
    if (!existing && userId) {
      existing = await this.prisma.laborContract.findFirst({
        where: { id: contractId, project: { members: { some: { userId } } } },
      });
    }
    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    const paymentId = payment.id ?? randomUUID();
    const currentPayment = await this.prisma.laborPayment.findFirst({
      where: { id: paymentId, laborContractId: existing.id },
      select: { id: true, createdById: true },
    });

    if (currentPayment) {
      await this.prisma.laborPayment.update({
        where: { id: currentPayment.id },
        data: {
          data: payment.data,
          valor: payment.valor,
          descricao: payment.descricao,
          comprovante: payment.comprovante || null,
        },
      });
    } else {
      await this.prisma.laborPayment.create({
        data: {
          id: paymentId,
          data: payment.data,
          valor: payment.valor,
          descricao: payment.descricao,
          comprovante: payment.comprovante || null,
          laborContractId: existing.id,
          createdById: payment.createdById ?? userId ?? null,
        },
      });
    }

    const allPayments = await this.prisma.laborPayment.findMany({
      where: { laborContractId: existing.id },
    });
    const totals = this.getPaymentTotals(allPayments, existing.valorTotal);

    const previousStatus = existing.status;

    await this.prisma.laborContract.update({
      where: { id: existing.id },
      data: {
        valorPago: totals.valorPago,
        status: totals.status,
      },
    });

    const updated = await this.prisma.laborContract.findUnique({
      where: { id: existing.id },
      include: {
        pagamentos: {
          orderBy: { data: 'asc' },
          include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
        },
        linkedWorkItems: { select: { workItemId: true } },
      },
    });

    if (updated) {
      await this.emitLaborPaymentRecordedNotification(
        instanceId,
        {
          id: updated.id,
          projectId: updated.projectId,
          descricao: updated.descricao,
        },
        {
          id: paymentId,
          valor: payment.valor,
          data: payment.data,
        },
        userId,
      );

      await this.emitLaborContractStatusChangedNotification(
        instanceId,
        {
          id: updated.id,
          projectId: updated.projectId,
          descricao: updated.descricao,
          status: updated.status,
          valorPago: updated.valorPago,
          valorTotal: updated.valorTotal,
        },
        previousStatus,
        userId,
      );
    }

    return updated;
  }

  async remove(id: string, instanceId: string, userId?: string) {
    let existing = await this.prisma.laborContract.findFirst({
      where: { id, project: { instanceId } },
    });
    if (!existing && userId) {
      existing = await this.prisma.laborContract.findFirst({
        where: { id, project: { members: { some: { userId } } } },
      });
    }

    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    await ensureProjectWritable(this.prisma, existing.projectId);

    const payments = await this.prisma.laborPayment.findMany({
      where: { laborContractId: existing.id },
      select: { comprovante: true },
    });

    await removeLocalUploads(payments.map(payment => payment.comprovante));

    await this.prisma.laborPayment.deleteMany({
      where: { laborContractId: existing.id },
    });
    await this.prisma.laborContractWorkItem.deleteMany({
      where: { laborContractId: existing.id },
    });
    await this.prisma.laborContract.delete({ where: { id: existing.id } });

    return { deleted: 1 };
  }
}
