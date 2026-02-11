import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';
import { ensureProjectAccess } from '../common/project-access.util';

interface LaborPaymentInput {
  id?: string;
  data: string;
  valor: number;
  descricao: string;
  comprovante?: string;
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
  userId?: string;
}

@Injectable()
export class LaborContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeOrder(value?: number) {
    if (!Number.isFinite(value)) return 0;
    const normalized = Math.floor(value as number);
    if (normalized > 2147483647) {
      return Math.floor(normalized / 1000);
    }
    if (normalized < -2147483648) return 0;
    return normalized;
  }

  private async ensureProject(projectId: string, instanceId: string, userId?: string) {
    return ensureProjectAccess(this.prisma, projectId, instanceId, userId);
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
        pagamentos: { orderBy: { data: 'asc' } },
        linkedWorkItems: { select: { workItemId: true } },
      },
    });
  }

  async create(input: CreateLaborContractInput) {
    await this.ensureProject(input.projectId, input.instanceId, input.userId);
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

    return this.prisma.$transaction(async prisma => {
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
          })),
        });
      }

      return prisma.laborContract.findUnique({
        where: { id: contract.id },
        include: {
          pagamentos: { orderBy: { data: 'asc' } },
          linkedWorkItems: { select: { workItemId: true } },
        },
      });
    });
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

    return this.prisma.$transaction(async prisma => {
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
        await prisma.laborPayment.deleteMany({
          where: { laborContractId: updated.id },
        });

        if (pagamentos.length) {
          await prisma.laborPayment.createMany({
            data: pagamentos.map(p => ({
              id: p.id,
              data: p.data,
              valor: p.valor,
              descricao: p.descricao,
              comprovante: p.comprovante || null,
              laborContractId: updated.id,
            })),
          });
        }
      }

      return prisma.laborContract.findUnique({
        where: { id: updated.id },
        include: {
          pagamentos: { orderBy: { data: 'asc' } },
          linkedWorkItems: { select: { workItemId: true } },
        },
      });
    });
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
