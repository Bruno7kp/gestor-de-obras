import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateBiddingInput {
  instanceId: string;
  userId?: string;
  tenderNumber: string;
  clientName: string;
  object: string;
  openingDate: string;
  expirationDate: string;
  estimatedValue: number;
  ourProposalValue: number;
  status: string;
  bdi: number;
  itemsSnapshot?: unknown;
  assetsSnapshot?: unknown;
}

interface UpdateBiddingInput extends Partial<CreateBiddingInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class BiddingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(instanceId: string) {
    return this.prisma.biddingProcess.findMany({
      where: { instanceId },
      orderBy: { openingDate: 'desc' },
    });
  }

  findById(id: string, instanceId: string) {
    return this.prisma.biddingProcess.findFirst({
      where: { id, instanceId },
    });
  }

  async create(input: CreateBiddingInput) {
    const created = await this.prisma.biddingProcess.create({
      data: {
        instanceId: input.instanceId,
        tenderNumber: input.tenderNumber,
        clientName: input.clientName,
        object: input.object,
        openingDate: input.openingDate,
        expirationDate: input.expirationDate,
        estimatedValue: input.estimatedValue,
        ourProposalValue: input.ourProposalValue,
        status: input.status,
        bdi: input.bdi,
        itemsSnapshot: (input.itemsSnapshot ?? []) as Prisma.InputJsonValue,
        assetsSnapshot: (input.assetsSnapshot ?? []) as Prisma.InputJsonValue,
        createdById: input.userId ?? null,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'CREATE',
      model: 'BiddingProcess',
      entityId: created.id,
      after: created as any,
    });

    return created;
  }

  async update(input: UpdateBiddingInput) {
    const existing = await this.prisma.biddingProcess.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!existing) throw new NotFoundException('Licitacao nao encontrada');

    return this.prisma.biddingProcess.update({
      where: { id: input.id },
      data: {
        tenderNumber: input.tenderNumber ?? existing.tenderNumber,
        clientName: input.clientName ?? existing.clientName,
        object: input.object ?? existing.object,
        openingDate: input.openingDate ?? existing.openingDate,
        expirationDate: input.expirationDate ?? existing.expirationDate,
        estimatedValue: input.estimatedValue ?? existing.estimatedValue,
        ourProposalValue: input.ourProposalValue ?? existing.ourProposalValue,
        status: input.status ?? existing.status,
        bdi: input.bdi ?? existing.bdi,
        itemsSnapshot: (input.itemsSnapshot ?? existing.itemsSnapshot) as Prisma.InputJsonValue,
        assetsSnapshot: (input.assetsSnapshot ?? existing.assetsSnapshot) as Prisma.InputJsonValue,
        updatedById: input.userId ?? null,
      },
    }).then(updated => {
      void this.auditService.log({
        instanceId: input.instanceId!,
        userId: input.userId,
        action: 'UPDATE',
        model: 'BiddingProcess',
        entityId: input.id,
        before: existing as any,
        after: updated as any,
      });
      return updated;
    });
  }

  async remove(id: string, instanceId: string, userId?: string) {
    const existing = await this.prisma.biddingProcess.findFirst({
      where: { id, instanceId },
    });
    if (!existing) throw new NotFoundException('Licitacao nao encontrada');

    await this.prisma.biddingProcess.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'BiddingProcess',
      entityId: id,
      before: existing as any,
    });

    return { deleted: 1 };
  }
}
