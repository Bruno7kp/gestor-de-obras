import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Bypass auth guard for debug endpoints
@Controller('_debug')
export class DebugController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('permissions/:userId')
  async debugPermissions(@Param('userId') userId: string) {
    // Method 1: userRole -> role -> permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    // Method 2: Direct query
    const roleIds = userRoles.map((ur) => ur.roleId);
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });

    return {
      userId,
      method1: {
        userRoles: userRoles.length,
        roles: userRoles.map((ur) => ({
          roleId: ur.roleId,
          roleName: ur.role.name,
          permissionCount: ur.role.permissions.length,
          permissions: ur.role.permissions.map((rp) => rp.permission.code),
        })),
      },
      method2: {
        rolePermissions: rolePermissions.length,
        permissions: Array.from(
          new Set(rolePermissions.map((rp) => rp.permission.code)),
        ),
      },
    };
  }
}
