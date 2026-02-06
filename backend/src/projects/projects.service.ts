import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { removeLocalUpload, removeLocalUploads } from '../uploads/file.utils';

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
  measurementNumber?: number;
  logo?: string | null;
  bdi?: number;
  groupId?: string | null;
  contractTotalOverride?: number | null;
  currentTotalOverride?: number | null;
  theme?: {
    fontFamily?: string;
    primary?: string;
    accent?: string;
    accentText?: string;
    border?: string;
    currencySymbol?: string;
    header?: { bg?: string; text?: string };
    category?: { bg?: string; text?: string };
    footer?: { bg?: string; text?: string };
    kpiHighlight?: { bg?: string; text?: string };
  };
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
        history: true,
        expenses: true,
        assets: true,
        theme: true,
        planning: {
          include: { tasks: true, forecasts: true, milestones: true },
        },
        journal: { include: { entries: true } },
        workforce: { include: { documentos: true, responsabilidades: true } },
        laborContracts: {
          include: { pagamentos: { orderBy: { data: 'asc' } } },
        },
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
        referenceDate:
          input.referenceDate || new Date().toISOString().slice(0, 10),
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
      include: { theme: true },
    });

    if (!existing) throw new NotFoundException('Projeto nao encontrado');

    const themeInput = input.theme;
    if (themeInput) {
      const fallbackTheme = {
        fontFamily: existing.theme?.fontFamily ?? 'Inter',
        primary: existing.theme?.primary ?? '#1e293b',
        accent: existing.theme?.accent ?? '#4f46e5',
        accentText: existing.theme?.accentText ?? '#ffffff',
        border: existing.theme?.border ?? '#e2e8f0',
        currencySymbol: existing.theme?.currencySymbol ?? 'R$',
        headerBg: existing.theme?.headerBg ?? '#1e293b',
        headerText: existing.theme?.headerText ?? '#ffffff',
        categoryBg: existing.theme?.categoryBg ?? '#f8fafc',
        categoryText: existing.theme?.categoryText ?? '#1e293b',
        footerBg: existing.theme?.footerBg ?? '#0f172a',
        footerText: existing.theme?.footerText ?? '#ffffff',
        kpiBg: existing.theme?.kpiBg ?? '#eff6ff',
        kpiText: existing.theme?.kpiText ?? '#1e40af',
      };

      await this.prisma.pDFTheme.upsert({
        where: { projectId: input.id },
        create: {
          projectId: input.id,
          fontFamily: themeInput.fontFamily ?? fallbackTheme.fontFamily,
          primary: themeInput.primary ?? fallbackTheme.primary,
          accent: themeInput.accent ?? fallbackTheme.accent,
          accentText: themeInput.accentText ?? fallbackTheme.accentText,
          border: themeInput.border ?? fallbackTheme.border,
          currencySymbol:
            themeInput.currencySymbol ?? fallbackTheme.currencySymbol,
          headerBg: themeInput.header?.bg ?? fallbackTheme.headerBg,
          headerText: themeInput.header?.text ?? fallbackTheme.headerText,
          categoryBg: themeInput.category?.bg ?? fallbackTheme.categoryBg,
          categoryText: themeInput.category?.text ?? fallbackTheme.categoryText,
          footerBg: themeInput.footer?.bg ?? fallbackTheme.footerBg,
          footerText: themeInput.footer?.text ?? fallbackTheme.footerText,
          kpiBg: themeInput.kpiHighlight?.bg ?? fallbackTheme.kpiBg,
          kpiText: themeInput.kpiHighlight?.text ?? fallbackTheme.kpiText,
        },
        update: {
          fontFamily: themeInput.fontFamily ?? fallbackTheme.fontFamily,
          primary: themeInput.primary ?? fallbackTheme.primary,
          accent: themeInput.accent ?? fallbackTheme.accent,
          accentText: themeInput.accentText ?? fallbackTheme.accentText,
          border: themeInput.border ?? fallbackTheme.border,
          currencySymbol:
            themeInput.currencySymbol ?? fallbackTheme.currencySymbol,
          headerBg: themeInput.header?.bg ?? fallbackTheme.headerBg,
          headerText: themeInput.header?.text ?? fallbackTheme.headerText,
          categoryBg: themeInput.category?.bg ?? fallbackTheme.categoryBg,
          categoryText: themeInput.category?.text ?? fallbackTheme.categoryText,
          footerBg: themeInput.footer?.bg ?? fallbackTheme.footerBg,
          footerText: themeInput.footer?.text ?? fallbackTheme.footerText,
          kpiBg: themeInput.kpiHighlight?.bg ?? fallbackTheme.kpiBg,
          kpiText: themeInput.kpiHighlight?.text ?? fallbackTheme.kpiText,
        },
      });
    }

    return this.prisma.project.update({
      where: { id: input.id },
      data: {
        name: input.name ?? existing.name,
        companyName: input.companyName ?? existing.companyName,
        companyCnpj: input.companyCnpj ?? existing.companyCnpj,
        location: input.location ?? existing.location,
        referenceDate: input.referenceDate ?? existing.referenceDate,
        measurementNumber:
          input.measurementNumber ?? existing.measurementNumber,
        logo: input.logo ?? existing.logo,
        bdi: input.bdi ?? existing.bdi,
        groupId: input.groupId ?? existing.groupId,
        contractTotalOverride:
          input.contractTotalOverride ?? existing.contractTotalOverride,
        currentTotalOverride:
          input.currentTotalOverride ?? existing.currentTotalOverride,
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

    const [assets, expenses, forecasts, journalEntries, workforce, payments] =
      await Promise.all([
        this.prisma.projectAsset.findMany({
          where: { projectId: id },
          select: { data: true },
        }),
        this.prisma.projectExpense.findMany({
          where: { projectId: id },
          select: { paymentProof: true, invoiceDoc: true },
        }),
        this.prisma.materialForecast.findMany({
          where: { projectPlanning: { projectId: id } },
          select: { paymentProof: true },
        }),
        this.prisma.journalEntry.findMany({
          where: { projectJournal: { projectId: id } },
          select: { photoUrls: true },
        }),
        this.prisma.workforceMember.findMany({
          where: { projectId: id },
          select: { foto: true, documentos: { select: { arquivoUrl: true } } },
        }),
        this.prisma.laborPayment.findMany({
          where: { laborContract: { projectId: id } },
          select: { comprovante: true },
        }),
      ]);

    await removeLocalUpload(existing.logo);
    await removeLocalUploads(assets.map((asset) => asset.data));
    await removeLocalUploads(
      expenses.flatMap((expense) => [expense.paymentProof, expense.invoiceDoc]),
    );
    await removeLocalUploads(
      forecasts.map((forecast) => forecast.paymentProof),
    );
    await removeLocalUploads(
      journalEntries.flatMap((entry) => entry.photoUrls ?? []),
    );
    await removeLocalUploads(workforce.map((member) => member.foto));
    await removeLocalUploads(
      workforce.flatMap((member) =>
        member.documentos.map((doc) => doc.arquivoUrl),
      ),
    );
    await removeLocalUploads(payments.map((payment) => payment.comprovante));

    await this.prisma.workItemResponsibility.deleteMany({
      where: { workItem: { projectId: id } },
    });

    await this.prisma.workItem.deleteMany({ where: { projectId: id } });
    await this.prisma.projectExpense.deleteMany({ where: { projectId: id } });
    await this.prisma.measurementSnapshot.deleteMany({
      where: { projectId: id },
    });
    await this.prisma.projectAsset.deleteMany({ where: { projectId: id } });
    await this.prisma.staffDocument.deleteMany({
      where: { workforceMember: { projectId: id } },
    });
    await this.prisma.workforceMember.deleteMany({ where: { projectId: id } });

    const planning = await this.prisma.projectPlanning.findFirst({
      where: { projectId: id },
    });

    if (planning) {
      await this.prisma.planningTask.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await this.prisma.materialForecast.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await this.prisma.milestone.deleteMany({
        where: { projectPlanningId: planning.id },
      });
      await this.prisma.projectPlanning.delete({ where: { id: planning.id } });
    }

    const journal = await this.prisma.projectJournal.findFirst({
      where: { projectId: id },
    });

    if (journal) {
      await this.prisma.journalEntry.deleteMany({
        where: { projectJournalId: journal.id },
      });
      await this.prisma.projectJournal.delete({ where: { id: journal.id } });
    }

    await this.prisma.pDFTheme.deleteMany({ where: { projectId: id } });

    return this.prisma.project.delete({ where: { id } });
  }
}
