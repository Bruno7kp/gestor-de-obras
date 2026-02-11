import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  userId: string;
  permissions: string[];
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
  order?: number;
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

  async findAll(
    instanceId: string,
    userId: string,
    permissions: string[],
    groupId?: string,
  ) {
    // Check if user has general access to all projects
    const hasGeneralAccess =
      permissions.includes('projects_general.view') ||
      permissions.includes('projects_general.edit');

    const baseWhere = {
      instanceId,
      ...(groupId ? { groupId } : {}),
    };

    const projects = await this.prisma.project.findMany({
      where: hasGeneralAccess
        ? baseWhere
        : {
            ...baseWhere,
            members: {
              some: {
                userId,
                assignedRole: {
                  permissions: {
                    some: {
                      permission: {
                        code: {
                          in: [
                            'projects_specific.view',
                            'projects_specific.edit',
                            'projects_general.view',
                            'projects_general.edit',
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    if (projects.length === 0) return projects;

    const aggregates = await this.prisma.workItem.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projects.map((project) => project.id) },
        parentId: null,
      },
      _sum: {
        contractTotal: true,
        accumulatedTotal: true,
      },
    });

    const aggregateMap = new Map(
      aggregates.map((row) => [row.projectId, row] as const),
    );

    return projects.map((project) => {
      const totals = aggregateMap.get(project.id);
      const contractTotal = project.contractTotalOverride ?? totals?._sum.contractTotal ?? 0;
      const accumulatedTotal = totals?._sum.accumulatedTotal ?? 0;
      const progress = contractTotal > 0 ? (accumulatedTotal / contractTotal) * 100 : 0;
      return { ...project, progress };
    });
  }

  async canAccessProject(
    projectId: string,
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    // Check if user has general access
    const hasGeneralAccess =
      permissions.includes('projects_general.view') ||
      permissions.includes('projects_general.edit');

    if (hasGeneralAccess) {
      return true;
    }

    // Check if user is a member of this project with project permissions
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    if (!membership) return false;

    const roleCodes = membership.assignedRole.permissions.map(
      (rp) => rp.permission.code,
    );

    return (
      roleCodes.includes('projects_specific.view') ||
      roleCodes.includes('projects_specific.edit') ||
      roleCodes.includes('projects_general.view') ||
      roleCodes.includes('projects_general.edit')
    );
  }

  async canEditProject(
    projectId: string,
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const hasGeneralEdit = permissions.includes('projects_general.edit');
    if (hasGeneralEdit) return true;

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    if (!membership) return false;

    const roleCodes = membership.assignedRole.permissions.map(
      (rp) => rp.permission.code,
    );

    return (
      roleCodes.includes('projects_specific.edit') ||
      roleCodes.includes('projects_general.edit')
    );
  }

  async findById(
    id: string,
    instanceId: string,
    userId: string,
    permissions: string[],
  ) {
    // Check if user can access this project
    const canAccess = await this.canAccessProject(id, userId, permissions);
    if (!canAccess) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    let project = await this.prisma.project.findFirst({
      where: { id, instanceId },
      include: {
        items: true,
        history: true,
        expenses: true,
        assets: true,
        theme: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
                instanceId: true,
              },
            },
            assignedRole: {
              select: {
                id: true,
                name: true,
                permissions: {
                  include: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
        planning: {
          include: {
            tasks: true,
            forecasts: {
              include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
            },
            milestones: true,
          },
        },
        journal: { include: { entries: true } },
        workforce: { include: { documentos: true, responsabilidades: true } },
        laborContracts: {
          include: {
            pagamentos: {
              orderBy: { data: 'asc' },
              include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
            },
            linkedWorkItems: { select: { workItemId: true } },
          },
        },
      },
    });

    if (!project) {
      // Cross-instance: user is a member from another instance
      project = await this.prisma.project.findFirst({
        where: { id, members: { some: { userId } } },
        include: {
          items: true,
          history: true,
          expenses: true,
          assets: true,
          theme: true,
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  profileImage: true,
                  instanceId: true,
                },
              },
              assignedRole: {
                select: {
                  id: true,
                  name: true,
                  permissions: {
                    include: {
                      permission: { select: { code: true } },
                    },
                  },
                },
              },
            },
          },
          planning: {
            include: {
              tasks: true,
              forecasts: {
                include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
              },
              milestones: true,
            },
          },
          journal: { include: { entries: true } },
          workforce: { include: { documentos: true, responsabilidades: true } },
          laborContracts: {
            include: {
              pagamentos: {
                orderBy: { data: 'asc' },
                include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
              },
              linkedWorkItems: { select: { workItemId: true } },
            },
          },
        },
      });
    }

    return project;
  }

  async create(input: CreateProjectInput) {
    const lastProject = await this.prisma.project.findFirst({
      where: {
        instanceId: input.instanceId,
        groupId: input.groupId ?? null,
      },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = (lastProject?.order ?? -1) + 1;

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
        order: nextOrder,
      },
    });
  }

  async update(input: UpdateProjectInput) {
    const canEdit = await this.canEditProject(
      input.id,
      input.userId,
      input.permissions,
    );

    if (!canEdit) {
      throw new ForbiddenException('Sem permissao para editar o projeto');
    }

    let existing = await this.prisma.project.findFirst({
      where: { id: input.id, instanceId: input.instanceId },
      include: { theme: true },
    });

    if (!existing && input.userId) {
      existing = await this.prisma.project.findFirst({
        where: { id: input.id, members: { some: { userId: input.userId } } },
        include: { theme: true },
      });
    }

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
        groupId: input.groupId !== undefined ? input.groupId : existing.groupId,
        order: input.order ?? existing.order,
        contractTotalOverride:
          input.contractTotalOverride !== undefined
            ? input.contractTotalOverride
            : existing.contractTotalOverride,
        currentTotalOverride:
          input.currentTotalOverride !== undefined
            ? input.currentTotalOverride
            : existing.currentTotalOverride,
        strict: input.config?.strict ?? existing.strict,
        printCards: input.config?.printCards ?? existing.printCards,
        printSubtotals: input.config?.printSubtotals ?? existing.printSubtotals,
        showSignatures: input.config?.showSignatures ?? existing.showSignatures,
      },
    });
  }

  async remove(
    id: string,
    instanceId: string,
    userId: string,
    permissions: string[],
  ) {
    if (!permissions.includes('projects_general.edit')) {
      throw new ForbiddenException('Sem permissao para remover o projeto');
    }

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
          select: {
            id: true,
            foto: true,
            documentos: { select: { arquivoUrl: true } },
          },
        }),
        this.prisma.laborPayment.findMany({
          where: {
            laborContract: {
              OR: [{ projectId: id }, { associado: { projectId: id } }],
            },
          },
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

    const workforceIds = workforce.map((member) => member.id);

    await this.prisma.laborPayment.deleteMany({
      where: {
        laborContract: {
          OR: [
            { projectId: id },
            { associado: { projectId: id } },
            { associadoId: { in: workforceIds } },
          ],
        },
      },
    });
    await this.prisma.laborContractWorkItem.deleteMany({
      where: {
        laborContract: {
          OR: [
            { projectId: id },
            { associado: { projectId: id } },
            { associadoId: { in: workforceIds } },
          ],
        },
      },
    });
    await this.prisma.laborContract.deleteMany({
      where: {
        OR: [
          { projectId: id },
          { associado: { projectId: id } },
          { associadoId: { in: workforceIds } },
        ],
      },
    });

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

    await this.prisma.projectMember.deleteMany({ where: { projectId: id } });
    await this.prisma.pDFTheme.deleteMany({ where: { projectId: id } });

    return this.prisma.project.delete({ where: { id } });
  }

  /**
   * Returns projects from OTHER instances where the user is a member.
   */
  async getExternalProjects(userId: string, instanceId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            instanceId: true,
            instance: { select: { id: true, name: true } },
          },
        },
        assignedRole: {
          select: {
            id: true,
            name: true,
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    return memberships
      .filter((m) => m.project.instanceId !== instanceId)
      .map((m) => ({
        projectId: m.project.id,
        projectName: m.project.name,
        companyName: m.project.instance?.name ?? m.project.instanceId,
        instanceId: m.project.instanceId,
        instanceName: m.project.instance?.name ?? m.project.instanceId,
        assignedRole: {
          id: m.assignedRole.id,
          name: m.assignedRole.name,
          permissions: m.assignedRole.permissions.map((p) => p.permission.code),
        },
      }));
  }

  /**
   * Loads a project for a cross-instance member.
   * The user's access is verified via ProjectMember, not instance membership.
   */
  async findExternalById(projectId: string, userId: string) {
    // Verify user is a member of this project
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
      include: {
        assignedRole: {
          include: {
            permissions: {
              include: { permission: { select: { code: true } } },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        items: true,
        history: true,
        expenses: true,
        assets: true,
        theme: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileImage: true,
                instanceId: true,
              },
            },
            assignedRole: {
              select: {
                id: true,
                name: true,
                permissions: {
                  include: {
                    permission: { select: { code: true } },
                  },
                },
              },
            },
          },
        },
        planning: {
          include: {
            tasks: true,
            forecasts: {
              include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
            },
            milestones: true,
          },
        },
        journal: { include: { entries: true } },
        workforce: { include: { documentos: true, responsabilidades: true } },
        laborContracts: {
          include: {
            pagamentos: {
              orderBy: { data: 'asc' },
              include: { createdBy: { select: { id: true, name: true, profileImage: true } } },
            },
            linkedWorkItems: { select: { workItemId: true } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    return project;
  }
}
