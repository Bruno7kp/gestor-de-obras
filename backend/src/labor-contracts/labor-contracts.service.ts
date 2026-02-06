import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUploads } from '../uploads/file.utils';

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
  tipo: string;
  descricao: string;
  associadoId: string;
  valorTotal: number;
  dataInicio: string;
  dataFim?: string;
  linkedWorkItemId?: string;
  observacoes?: string;
  ordem?: number;
  pagamentos?: LaborPaymentInput[];
}

interface UpdateLaborContractInput extends Partial<CreateLaborContractInput> {
  id: string;
}

@Injectable()
export class LaborContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string, instanceId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Projeto nao encontrado');
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

  private getPaymentTotals(pagamentos: LaborPaymentInput[], valorTotal: number) {
    const valorPago = pagamentos.reduce((sum, p) => sum + (p.valor || 0), 0);
    const status = valorPago === 0 ? 'pendente' : valorPago >= valorTotal ? 'pago' : 'parcial';
    return { valorPago, status };
  }

  async findAll(projectId: string, instanceId: string) {
    await this.ensureProject(projectId, instanceId);
    return this.prisma.laborContract.findMany({
      where: { projectId },
      orderBy: { ordem: 'asc' },
      include: { pagamentos: { orderBy: { data: 'asc' } } },
    });
  }

  async create(input: CreateLaborContractInput) {
    await this.ensureProject(input.projectId, input.instanceId);
    await this.ensureWorkforceMember(input.associadoId, input.projectId);
    if (input.linkedWorkItemId) {
      await this.ensureWorkItem(input.linkedWorkItemId, input.projectId);
    }

    const pagamentos = input.pagamentos ?? [];
    const totals = this.getPaymentTotals(pagamentos, input.valorTotal);

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
          linkedWorkItemId: input.linkedWorkItemId || null,
          observacoes: input.observacoes || null,
          ordem: input.ordem ?? 0,
        },
      });

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
        include: { pagamentos: { orderBy: { data: 'asc' } } },
      });
    });
  }

  async update(input: UpdateLaborContractInput) {
    const existing = await this.prisma.laborContract.findFirst({
      where: { id: input.id, project: { instanceId: input.instanceId } },
    });

    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    if (input.associadoId) {
      await this.ensureWorkforceMember(input.associadoId, existing.projectId);
    }

    if (input.linkedWorkItemId) {
      await this.ensureWorkItem(input.linkedWorkItemId, existing.projectId);
    }

    const pagamentos = input.pagamentos;
    const valorTotal = input.valorTotal ?? existing.valorTotal;
    const totals = pagamentos ? this.getPaymentTotals(pagamentos, valorTotal) : null;

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
          linkedWorkItemId: input.linkedWorkItemId ?? existing.linkedWorkItemId,
          observacoes: input.observacoes ?? existing.observacoes,
          ordem: input.ordem ?? existing.ordem,
        },
      });

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
        include: { pagamentos: { orderBy: { data: 'asc' } } },
      });
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.laborContract.findFirst({
      where: { id, project: { instanceId } },
    });

    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    const payments = await this.prisma.laborPayment.findMany({
      where: { laborContractId: existing.id },
      select: { comprovante: true },
    });

    await removeLocalUploads(payments.map(payment => payment.comprovante));

    await this.prisma.laborPayment.deleteMany({
      where: { laborContractId: existing.id },
    });
    await this.prisma.laborContract.delete({ where: { id: existing.id } });

    return { deleted: 1 };
  }
}
