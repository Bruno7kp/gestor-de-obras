import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateProjectInput {
  name: string;
  companyName: string;
  companyCnpj?: string;
  location?: string;
  referenceDate?: string;
  bdi?: number;
  groupId?: string | null;
  instanceId: string;
}

interface UpdateProjectInput {
  id: string;
  instanceId: string;
  name?: string;
  companyName?: string;
  companyCnpj?: string;
  location?: string;
  referenceDate?: string;
  bdi?: number;
  groupId?: string | null;
  contractTotalOverride?: number | null;
  currentTotalOverride?: number | null;
  config?: {
    strict?: boolean;
    printCards?: boolean;
    printSubtotals?: boolean;
    showSignatures?: boolean;
  };
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(instanceId: string, groupId?: string) {
    return this.prisma.project.findMany({
      where: {
        instanceId,
        ...(groupId ? { groupId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  findById(id: string, instanceId: string) {
    return this.prisma.project.findFirst({
      where: { id, instanceId },
      include: {
        items: true,
        expenses: true,
        assets: true,
        planning: { include: { tasks: true, forecasts: true, milestones: true } },
        journal: { include: { entries: true } },
        workforce: { include: { documentos: true } },
      },
    });
  }

  create(input: CreateProjectInput) {
    return this.prisma.project.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        companyCnpj: input.companyCnpj || '',
        location: input.location || '',
        referenceDate: input.referenceDate || new Date().toISOString().slice(0, 10),
        measurementNumber: 1,
        logo: null,
        bdi: input.bdi ?? 25,
        strict: false,
        printCards: true,
        printSubtotals: true,
        showSignatures: true,
        instanceId: input.instanceId,
        groupId: input.groupId ?? null,
      },
    });
  }

  async update(input: UpdateProjectInput) {
    const existing = await this.prisma.project.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
    });

    if (!existing) throw new NotFoundException('Projeto nao encontrado');

    return this.prisma.project.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        companyName: input.companyName ?? existing.companyName,
        companyCnpj: input.companyCnpj ?? existing.companyCnpj,
        location: input.location ?? existing.location,
        referenceDate: input.referenceDate ?? existing.referenceDate,
        bdi: input.bdi ?? existing.bdi,
        groupId: input.groupId ?? existing.groupId,
        contractTotalOverride: input.contractTotalOverride ?? existing.contractTotalOverride,
        currentTotalOverride: input.currentTotalOverride ?? existing.currentTotalOverride,
        strict: input.config?.strict ?? existing.strict,
        printCards: input.config?.printCards ?? existing.printCards,
        printSubtotals: input.config?.printSubtotals ?? existing.printSubtotals,
        showSignatures: input.config?.showSignatures ?? existing.showSignatures,
      },
    });
  }

  async remove(id: string, instanceId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id, instanceId },
    });

    if (!existing) throw new NotFoundException('Projeto nao encontrado');

    await this.prisma.workItemResponsibility.deleteMany({
      where: { workItem: { projectId: id } },
    });

    await this.prisma.workItem.deleteMany({ where: { projectId: id } });
    await this.prisma.projectExpense.deleteMany({ where: { projectId: id } });
    await this.prisma.measurementSnapshot.deleteMany({ where: { projectId: id } });
    await this.prisma.projectAsset.deleteMany({ where: { projectId: id } });
    await this.prisma.staffDocument.deleteMany({
      where: { workforceMember: { projectId: id } },
    });
    await this.prisma.workforceMember.deleteMany({ where: { projectId: id } });

    const planning = await this.prisma.projectPlanning.findFirst({
      where: { projectId: id },
    });

    if (planning) {
      await this.prisma.planningTask.deleteMany({ where: { projectPlanningId: planning.id } });
      await this.prisma.materialForecast.deleteMany({ where: { projectPlanningId: planning.id } });
      await this.prisma.milestone.deleteMany({ where: { projectPlanningId: planning.id } });
      await this.prisma.projectPlanning.delete({ where: { id: planning.id } });
    }

    const journal = await this.prisma.projectJournal.findFirst({
      where: { projectId: id },
    });

    if (journal) {
      await this.prisma.journalEntry.deleteMany({ where: { projectJournalId: journal.id } });
      await this.prisma.projectJournal.delete({ where: { id: journal.id } });
    }

    await this.prisma.pDFTheme.deleteMany({ where: { projectId: id } });

    return this.prisma.project.delete({ where: { id } });
  }
}
