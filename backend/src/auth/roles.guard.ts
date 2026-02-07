import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Let AuthGuard handle unauthenticated requests on guarded routes.
      return true;
    }

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const hasRequiredRole = requiredRoles.some(role => roles.includes(role));
      if (!hasRequiredRole) {
        return false;
      }
    }

    // Check permissions if required (at least one permission must match)
    if (requiredPermissions && requiredPermissions.length > 0) {
      const permissions = Array.isArray(user.permissions) ? user.permissions : [];
      const hasRequiredPermission = requiredPermissions.some(perm => permissions.includes(perm));
      if (!hasRequiredPermission) {
        return false;
      }
    }

    return true;
  }
}
