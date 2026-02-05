import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface CreateBiddingInput {
  instanceId: string;
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
}

@Injectable()
export class BiddingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(input: CreateBiddingInput) {
    return this.prisma.biddingProcess.create({
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
      },
    });
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
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.biddingProcess.findFirst({
      where: { id, instanceId },
    });
    if (!existing) throw new NotFoundException('Licitacao nao encontrada');

    await this.prisma.biddingProcess.delete({ where: { id } });
    return { deleted: 1 };
  }
}
