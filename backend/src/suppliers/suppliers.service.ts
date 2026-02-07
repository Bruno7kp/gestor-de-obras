import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSupplierInput {
  instanceId: string;
  name: string;
  cnpj: string;
  contactName: string;
  email: string;
  phone: string;
  category: string;
  rating: number;
  notes?: string;
  order?: number;
}

interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
  id: string;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(instanceId: string) {
    return this.prisma.supplier.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Returns suppliers for a given instance (read-only).
   * Verifies the user has at least one project membership in that instance.
   */
  async findAllByInstance(instanceId: string, userId: string) {
    const membershipCount = await this.prisma.projectMember.count({
      where: {
        userId,
        project: { instanceId },
      },
    });

    if (membershipCount === 0) {
      return [];
    }

    return this.prisma.supplier.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string, instanceId: string) {
    return this.prisma.supplier.findFirst({
      where: { id, instanceId },
    });
  }

  create(input: CreateSupplierInput) {
    return this.prisma.supplier.create({
      data: {
        instanceId: input.instanceId,
        name: input.name,
        cnpj: input.cnpj,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        category: input.category,
        rating: input.rating,
        notes: input.notes || '',
        order: input.order ?? 0,
      },
    });
  }

  async update(input: UpdateSupplierInput) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!existing) throw new NotFoundException('Fornecedor nao encontrado');

    return this.prisma.supplier.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        cnpj: input.cnpj ?? existing.cnpj,
        contactName: input.contactName ?? existing.contactName,
        email: input.email ?? existing.email,
        phone: input.phone ?? existing.phone,
        category: input.category ?? existing.category,
        rating: input.rating ?? existing.rating,
        notes: input.notes ?? existing.notes,
        order: input.order ?? existing.order,
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, instanceId },
    });
    if (!existing) throw new NotFoundException('Fornecedor nao encontrado');

    await this.prisma.supplier.updateMany({
      where: { id, instanceId },
      data: {},
    });

    await this.prisma.supplier.delete({ where: { id } });
    return { deleted: 1 };
  }
}
