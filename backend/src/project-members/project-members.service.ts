import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AddMemberByEmailInput {
  projectId: string;
  email: string;
  roleId?: string;
  addedById: string;
  instanceId: string;
}

interface UpdateMemberInput {
  projectId: string;
  userId: string;
  roleId: string;
  instanceId: string;
}

const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      profileImage: true,
      status: true,
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
} as const;

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async listMembers(projectId: string, instanceId: string, userId?: string) {
    // First check if project belongs to user's instance
    let project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
    });

    // If not found in user's instance, check if user is a member of this project (cross-instance)
    if (!project && userId) {
      const membership = await this.prisma.projectMember.findFirst({
        where: { projectId, userId },
      });
      if (membership) {
        project = await this.prisma.project.findFirst({
          where: { id: projectId },
        });
      }
    }

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const roles = await this.prisma.role.findMany({
      where: { instanceId: project.instanceId },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    const generalAccessUsers = await this.prisma.user.findMany({
      where: {
        instanceId: project.instanceId,
        roles: {
          some: {
            role: {
              permissions: {
                some: {
                  permission: {
                    code: {
                      in: ['projects_general.view', 'projects_general.edit'],
                    },
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        profileImage: true,
        status: true,
        instanceId: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      members: members.map((m) => ({
        id: m.id,
        roleId: m.roleId,
        createdAt: m.createdAt,
        user: m.user,
        assignedRole: {
          id: m.assignedRole.id,
          name: m.assignedRole.name,
          permissions: m.assignedRole.permissions.map((rp) => rp.permission.code),
        },
      })),
      generalAccessUsers,
      roles,
    };
  }

  async addMemberByEmail(input: AddMemberByEmailInput) {
    // Verify project exists and belongs to instance
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, instanceId: input.instanceId },
    });

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    // Look up user globally by email
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { roles: { select: { roleId: true } } },
    });

    if (!user) {
      throw new NotFoundException('Nenhum usuario encontrado com este email');
    }

    const isInternal = user.instanceId === input.instanceId;

    // Resolve roleId: for internal users auto-pick their first instance role
    let resolvedRoleId = input.roleId;
    if (!resolvedRoleId) {
      if (isInternal) {
        const firstRole = user.roles[0];
        if (!firstRole) {
          throw new BadRequestException(
            'Usuario interno nao possui perfil atribuido',
          );
        }
        resolvedRoleId = firstRole.roleId;
      } else {
        throw new BadRequestException(
          'E obrigatorio selecionar um cargo para usuarios externos',
        );
      }
    } else {
      // Verify the role exists and belongs to the project's instance
      const role = await this.prisma.role.findFirst({
        where: { id: resolvedRoleId, instanceId: input.instanceId },
      });
      if (!role) {
        throw new NotFoundException('Perfil nao encontrado');
      }
    }

    // Check if user is already a member
    const existingMember = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: input.projectId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('Usuario ja e membro deste projeto');
    }

    const created = await this.prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: input.projectId,
        roleId: resolvedRoleId,
        addedById: input.addedById,
      },
      include: MEMBER_INCLUDE,
    });

    return {
      id: created.id,
      roleId: created.roleId,
      createdAt: created.createdAt,
      user: created.user,
      assignedRole: {
        id: created.assignedRole.id,
        name: created.assignedRole.name,
        permissions: created.assignedRole.permissions.map(
          (rp) => rp.permission.code,
        ),
      },
    };
  }

  async removeMember(projectId: string, userId: string, instanceId: string) {
    // Verify project exists and belongs to instance
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, instanceId },
    });

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    if (!member) {
      throw new NotFoundException('Membro nao encontrado');
    }

    await this.prisma.projectMember.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    });

    return { success: true };
  }

  async updateMember(input: UpdateMemberInput) {
    // Verify project exists and belongs to instance
    const project = await this.prisma.project.findFirst({
      where: { id: input.projectId, instanceId: input.instanceId },
    });

    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const member = await this.prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: input.userId,
          projectId: input.projectId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Membro nao encontrado');
    }

    // Verify the role exists and belongs to the project's instance
    const role = await this.prisma.role.findFirst({
      where: { id: input.roleId, instanceId: input.instanceId },
    });

    if (!role) {
      throw new NotFoundException('Perfil nao encontrado');
    }

    const updated = await this.prisma.projectMember.update({
      where: {
        userId_projectId: {
          userId: input.userId,
          projectId: input.projectId,
        },
      },
      data: { roleId: input.roleId },
      include: MEMBER_INCLUDE,
    });

    return {
      id: updated.id,
      roleId: updated.roleId,
      createdAt: updated.createdAt,
      user: updated.user,
      assignedRole: {
        id: updated.assignedRole.id,
        name: updated.assignedRole.name,
        permissions: updated.assignedRole.permissions.map(
          (rp) => rp.permission.code,
        ),
      },
    };
  }

  /**
   * Get the member's assigned role permissions for a specific project.
   * Returns null if user is not a member.
   */
  async getMemberPermissions(
    projectId: string,
    userId: string,
  ): Promise<string[] | null> {
    const member = await this.prisma.projectMember.findUnique({
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

    if (!member) return null;

    return member.assignedRole.permissions.map((rp) => rp.permission.code);
  }

  /**
   * Get all projects from OTHER instances where the user is a member.
   */
  async getExternalProjects(userId: string, homeInstanceId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: {
        userId,
        project: {
          instanceId: { not: homeInstanceId },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            companyName: true,
            instanceId: true,
            instance: { select: { name: true } },
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
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      projectId: m.project.id,
      projectName: m.project.name,
      companyName: m.project.companyName,
      instanceId: m.project.instanceId,
      instanceName: m.project.instance.name,
      assignedRole: {
        id: m.assignedRole.id,
        name: m.assignedRole.name,
        permissions: m.assignedRole.permissions.map((rp) => rp.permission.code),
      },
    }));
  }
}
