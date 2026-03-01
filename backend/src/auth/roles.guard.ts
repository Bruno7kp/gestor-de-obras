import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      // Let AuthGuard handle unauthenticated requests on guarded routes.
      return true;
    }

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const hasRequiredRole = requiredRoles.some((role) =>
        roles.includes(role),
      );
      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check permissions if required (at least one permission must match)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const permissions = Array.isArray(user.permissions)
        ? user.permissions
        : [];
      const hasRequiredPermission = requiredPermissions.some((perm) =>
        permissions.includes(perm),
      );

      if (!hasRequiredPermission) {
        // Fallback: check if the user is a member of any project with the required permission.
        // The service layer still enforces per-project access control.
        const hasProjectPermission = await this.checkProjectMemberPermissions(
          user.id,
          requiredPermissions,
        );
        if (!hasProjectPermission) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if the user has any project membership whose assigned role
   * grants at least one of the required permissions.
   */
  private async checkProjectMemberPermissions(
    userId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    const count = await this.prisma.projectMember.count({
      where: {
        user: { id: userId },
        assignedRole: {
          permissions: {
            some: {
              permission: {
                code: { in: requiredPermissions },
              },
            },
          },
        },
      },
    });
    return count > 0;
  }
}
