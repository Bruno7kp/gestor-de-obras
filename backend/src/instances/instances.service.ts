import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { UsersService } from '../users/users.service';
import { removeLocalUploads } from '../uploads/file.utils';

interface CreateInstanceInput {
  name: string;
  status?: string;
  admin?: {
    name: string;
    email: string;
    password: string;
  };
}

interface UpdateInstanceInput {
  name?: string;
  status?: string;
}

@Injectable()
export class InstancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly usersService: UsersService,
  ) {}

  async create(input: CreateInstanceInput) {
    // Check if instance with same name already exists
    const existingInstance = await this.prisma.instance.findFirst({
      where: { name: input.name },
    });

    if (existingInstance) {
      throw new BadRequestException(`Já existe uma instância com o nome "${input.name}"`);
    }

    const instance = await this.prisma.instance.create({
      data: {
        name: input.name,
        status: input.status || 'ACTIVE',
      },
    });

    await this.rolesService.seedDefaultRoles(instance.id);

    // Create admin user if provided
    if (input.admin) {
      try {
        const adminUser = await this.usersService.create({
          name: input.admin.name,
          email: input.admin.email,
          password: input.admin.password,
          instanceId: instance.id,
          status: 'ACTIVE',
        });

        // Assign Gestor Principal role to the user
        const gestorPrincipalRole = await this.prisma.role.findFirst({
          where: { 
            instanceId: instance.id, 
            name: 'Gestor Principal' 
          },
        });

        if (gestorPrincipalRole) {
          await this.prisma.userRole.create({
            data: {
              userId: adminUser.id,
              roleId: gestorPrincipalRole.id,
            },
          });
        } else {
          console.warn(
            `[Instance Creation] Gestor Principal role not found for instance ${instance.id}. Available roles:`,
            await this.prisma.role.findMany({
              where: { instanceId: instance.id },
              select: { id: true, name: true },
            })
          );
        }
      } catch (error) {
        // If admin creation fails, delete the instance
        await this.prisma.instance.delete({
          where: { id: instance.id },
        });
        throw error;
      }
    }

    return instance;
  }

  findAll() {
    return this.prisma.instance.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.instance.findUnique({
      where: { id },
    });
  }

  async update(id: string, input: UpdateInstanceInput) {
    // If name is being updated, check for duplicates
    if (input.name) {
      const existingInstance = await this.prisma.instance.findFirst({
        where: { 
          name: input.name,
          NOT: { id },
        },
      });

      if (existingInstance) {
        throw new BadRequestException(`Já existe uma instância com o nome "${input.name}"`);
      }
    }

    return this.prisma.instance.update({
      where: { id },
      data: input,
    });
  }

  async delete(id: string) {
    // Get the first instance (main instance) - cannot be deleted
    const instances = await this.prisma.instance.findMany({
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    if (instances.length > 0 && instances[0].id === id) {
      throw new BadRequestException('A instância principal não pode ser deletada');
    }

    // Delete in cascade to avoid foreign key conflicts
    try {
      const projectIds = (await this.prisma.project.findMany({
        where: { instanceId: id },
        select: { id: true },
      })).map(p => p.id);

      // Collect all file URLs to delete
      const filesToDelete: Array<string | null> = [];

      // 1. Collect ProjectAsset files
      const projectAssets = await this.prisma.projectAsset.findMany({
        where: { projectId: { in: projectIds } },
        select: { data: true },
      });
      filesToDelete.push(...projectAssets.map(a => a.data));

      // 2. Collect StaffDocument files
      const staffDocs = await this.prisma.staffDocument.findMany({
        where: {
          workforceMember: { projectId: { in: projectIds } },
        },
        select: { arquivoUrl: true },
      });
      filesToDelete.push(...staffDocs.map(d => d.arquivoUrl));

      // 3. Collect WorkforceMember photos
      const workforceMembers = await this.prisma.workforceMember.findMany({
        where: { projectId: { in: projectIds } },
        select: { foto: true },
      });
      filesToDelete.push(...workforceMembers.map(w => w.foto));

      // 4. Collect User profile images
      const users = await this.prisma.user.findMany({
        where: { instanceId: id },
        select: { profileImage: true },
      });
      filesToDelete.push(...users.map(u => u.profileImage));

      // 5. Collect JournalEntry photos
      const journals = await this.prisma.projectJournal.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true },
      });
      const journalIds = journals.map(j => j.id);
      
      const journalEntries = await this.prisma.journalEntry.findMany({
        where: { projectJournalId: { in: journalIds } },
        select: { photoUrls: true },
      });
      
      for (const entry of journalEntries) {
        if (entry.photoUrls && Array.isArray(entry.photoUrls)) {
          filesToDelete.push(...entry.photoUrls);
        }
      }

      // Delete all collected files from filesystem
      if (filesToDelete.length > 0) {
        await removeLocalUploads(filesToDelete);
      }

      // 1. Delete all user roles for this instance's users
      await this.prisma.userRole.deleteMany({
        where: {
          user: {
            instanceId: id,
          },
        },
      });

      // 2. Delete all users in this instance
      await this.prisma.user.deleteMany({
        where: { instanceId: id },
      });

      // 3. Delete all role permissions in this instance
      await this.prisma.rolePermission.deleteMany({
        where: {
          role: { instanceId: id },
        },
      });

      // 4. Delete all roles in this instance
      await this.prisma.role.deleteMany({
        where: { instanceId: id },
      });

      // 5. Delete all company certificates
      await this.prisma.companyCertificate.deleteMany({
        where: {
          globalSettings: { instanceId: id },
        },
      });

      // 6. Get all project planning for this instance
      const projectPlannings = await this.prisma.projectPlanning.findMany({
        where: { projectId: { in: projectIds } },
      });

      const projectPlanningIds = projectPlannings.map((pp) => pp.id);

      // 7. Delete milestones (related to ProjectPlanning)
      await this.prisma.milestone.deleteMany({
        where: { projectPlanningId: { in: projectPlanningIds } },
      });

      // 8. Delete planning tasks (related to ProjectPlanning)
      await this.prisma.planningTask.deleteMany({
        where: { projectPlanningId: { in: projectPlanningIds } },
      });

      // 9. Delete material forecasts (related to ProjectPlanning)
      await this.prisma.materialForecast.deleteMany({
        where: { projectPlanningId: { in: projectPlanningIds } },
      });

      // 10. Delete project planning
      await this.prisma.projectPlanning.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 11. Delete labor payments
      await this.prisma.laborPayment.deleteMany({
        where: {
          laborContract: { projectId: { in: projectIds } },
        },
      });

      // 11b. Delete labor contract work item links
      await this.prisma.laborContractWorkItem.deleteMany({
        where: {
          laborContract: { projectId: { in: projectIds } },
        },
      });

      // 12. Delete labor contracts
      await this.prisma.laborContract.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 13. Delete staff documents
      await this.prisma.staffDocument.deleteMany({
        where: {
          workforceMember: { projectId: { in: projectIds } },
        },
      });

      // 14. Delete workforce members
      await this.prisma.workforceMember.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 15. Delete work item responsibilities
      await this.prisma.workItemResponsibility.deleteMany({
        where: {
          workItem: { projectId: { in: projectIds } },
        },
      });

      // 16. Delete work items
      await this.prisma.workItem.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 17. Delete project expenses
      await this.prisma.projectExpense.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 18. Delete project assets
      await this.prisma.projectAsset.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 19. Delete measurement snapshots
      await this.prisma.measurementSnapshot.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 20. Delete journal entries and journals
      await this.prisma.journalEntry.deleteMany({
        where: { projectJournalId: { in: journalIds } },
      });

      await this.prisma.projectJournal.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 21. Delete PDF themes
      await this.prisma.pDFTheme.deleteMany({
        where: { projectId: { in: projectIds } },
      });

      // 22. Delete projects
      await this.prisma.project.deleteMany({
        where: { instanceId: id },
      });

      // 23. Delete project groups
      await this.prisma.projectGroup.deleteMany({
        where: { instanceId: id },
      });

      // 24. Delete suppliers and related material forecasts if any remain
      const suppliers = await this.prisma.supplier.findMany({
        where: { instanceId: id },
      });

      const supplierIds = suppliers.map((s) => s.id);

      // Delete any material forecasts linked to these suppliers
      await this.prisma.materialForecast.deleteMany({
        where: { supplierId: { in: supplierIds } },
      });

      // 25. Delete suppliers
      await this.prisma.supplier.deleteMany({
        where: { instanceId: id },
      });

      // 26. Delete bidding processes
      await this.prisma.biddingProcess.deleteMany({
        where: { instanceId: id },
      });

      // 27. Delete global settings
      await this.prisma.globalSettings.deleteMany({
        where: { instanceId: id },
      });

      // 28. Delete subscription
      await this.prisma.subscription.deleteMany({
        where: { instanceId: id },
      });

      // 29. Finally, delete the instance
      return this.prisma.instance.delete({
        where: { id },
      });
    } catch (error) {
      throw new BadRequestException(
        `Erro ao deletar a instância: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }
}
