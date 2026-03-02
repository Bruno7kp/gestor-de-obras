import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

interface CreateContractorInput {
  instanceId: string;
  userId?: string;
  name: string;
  cnpj?: string;
  type?: string;
  city?: string;
  specialty?: string;
  status?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  pixKey?: string;
  notes?: string;
  order?: number;
}

interface UpdateContractorInput extends Partial<CreateContractorInput> {
  id: string;
  userId?: string;
}

@Injectable()
export class ContractorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(instanceId: string) {
    return this.prisma.contractor.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * Returns contractors for a given instance (read-only).
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

    return this.prisma.contractor.findMany({
      where: { instanceId },
      orderBy: { order: 'asc' },
    });
  }

  findById(id: string, instanceId: string) {
    return this.prisma.contractor.findFirst({
      where: { id, instanceId },
    });
  }

  async create(input: CreateContractorInput) {
    const created = await this.prisma.contractor.create({
      data: {
        instanceId: input.instanceId,
        name: input.name,
        cnpj: input.cnpj ?? '',
        type: input.type ?? 'PJ',
        city: input.city ?? '',
        specialty: input.specialty ?? null,
        status: input.status ?? 'Ativo',
        contactName: input.contactName ?? '',
        email: input.email ?? '',
        phone: input.phone ?? '',
        bankName: input.bankName ?? '',
        bankAgency: input.bankAgency ?? '',
        bankAccount: input.bankAccount ?? '',
        pixKey: input.pixKey ?? null,
        notes: input.notes ?? '',
        order: input.order ?? 0,
        createdById: input.userId ?? null,
      },
    });

    void this.auditService.log({
      instanceId: input.instanceId,
      userId: input.userId,
      action: 'CREATE',
      model: 'Contractor',
      entityId: created.id,
      after: created as Record<string, unknown>,
    });

    return created;
  }

  /**
   * Finds an existing contractor by name (case-insensitive) in the instance,
   * or creates a new one with minimal data. Used by the workforce autocomplete
   * to auto-create contractors when a new name is typed.
   */
  async findOrCreate(name: string, instanceId: string, userId?: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new NotFoundException('Nome do prestador não pode ser vazio');
    }

    // Try to find existing (case-insensitive)
    const existing = await this.prisma.contractor.findFirst({
      where: {
        instanceId,
        name: { equals: trimmed, mode: 'insensitive' },
      },
    });

    if (existing) {
      return { contractor: existing, created: false };
    }

    // Create new with minimal data
    const created = await this.prisma.contractor.create({
      data: {
        instanceId,
        name: trimmed,
        createdById: userId ?? null,
      },
    });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'CREATE',
      model: 'Contractor',
      entityId: created.id,
      after: created as Record<string, unknown>,
      metadata: { operation: 'autoCreate', source: 'workforce' },
    });

    return { contractor: created, created: true };
  }

  async update(input: UpdateContractorInput) {
    const existing = await this.prisma.contractor.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });
    if (!existing) throw new NotFoundException('Prestador não encontrado');

    return this.prisma.contractor
      .update({
        where: { id: input.id },
        data: {
          name: input.name ?? existing.name,
          cnpj: input.cnpj ?? existing.cnpj,
          type: input.type ?? existing.type,
          city: input.city ?? existing.city,
          specialty:
            input.specialty !== undefined
              ? input.specialty
              : existing.specialty,
          status: input.status ?? existing.status,
          contactName: input.contactName ?? existing.contactName,
          email: input.email ?? existing.email,
          phone: input.phone ?? existing.phone,
          bankName: input.bankName ?? existing.bankName,
          bankAgency: input.bankAgency ?? existing.bankAgency,
          bankAccount: input.bankAccount ?? existing.bankAccount,
          pixKey: input.pixKey !== undefined ? input.pixKey : existing.pixKey,
          notes: input.notes ?? existing.notes,
          order: input.order ?? existing.order,
          updatedById: input.userId ?? null,
        },
      })
      .then((updated) => {
        void this.auditService.log({
          instanceId: input.instanceId!,
          userId: input.userId,
          action: 'UPDATE',
          model: 'Contractor',
          entityId: input.id,
          before: existing as Record<string, unknown>,
          after: updated as Record<string, unknown>,
        });
        return updated;
      });
  }

  async batchReorder(
    items: Array<{ id: string; order: number }>,
    instanceId: string,
    userId?: string,
  ) {
    if (items.length === 0) return [];

    const txOps = items.map((item) =>
      this.prisma.contractor.updateMany({
        where: { id: item.id, instanceId },
        data: { order: item.order, updatedById: userId ?? null },
      }),
    );

    await this.prisma.$transaction(txOps);

    void this.auditService.log({
      instanceId,
      userId,
      action: 'UPDATE',
      model: 'Contractor',
      entityId: instanceId,
      metadata: {
        batch: true,
        operation: 'reorder',
        count: items.length,
      },
    });

    return { updated: items.length };
  }

  async remove(id: string, instanceId: string, userId?: string) {
    const existing = await this.prisma.contractor.findFirst({
      where: { id, instanceId },
    });
    if (!existing) throw new NotFoundException('Prestador não encontrado');

    // Unlink workforce members before deleting
    await this.prisma.workforceMember.updateMany({
      where: { contractorId: id },
      data: { contractorId: null },
    });

    await this.prisma.contractor.delete({ where: { id } });

    void this.auditService.log({
      instanceId,
      userId,
      action: 'DELETE',
      model: 'Contractor',
      entityId: id,
      before: existing as Record<string, unknown>,
    });

    return { deleted: 1 };
  }
}
