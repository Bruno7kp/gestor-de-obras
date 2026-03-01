import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Resolves which instanceId the user should operate on for instance-scoped
 * resources (global stock, purchase requests, stock requests, etc.).
 *
 * - If targetInstanceId is the same as homeInstanceId or not provided → use home.
 * - If targetInstanceId differs, verify the user is a ProjectMember in at
 *   least one project of that target instance.
 *
 * Returns the validated instanceId to use.
 */
export async function resolveInstanceAccess(
  prisma: PrismaService,
  userId: string,
  homeInstanceId: string,
  targetInstanceId?: string,
): Promise<string> {
  if (!targetInstanceId || targetInstanceId === homeInstanceId) {
    return homeInstanceId;
  }

  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      project: { instanceId: targetInstanceId },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new ForbiddenException('Você não tem acesso a esta instância');
  }

  return targetInstanceId;
}

/**
 * For cross-instance access, resolves permissions from the ProjectMember's
 * assignedRole instead of the user's home-instance roles.
 *
 * Aggregates permissions across ALL project memberships the user has in that
 * target instance (the union).
 */
export async function getCrossInstancePermissions(
  prisma: PrismaService,
  userId: string,
  targetInstanceId: string,
): Promise<string[]> {
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId,
      project: { instanceId: targetInstanceId },
    },
    select: {
      assignedRole: {
        select: {
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  const codes = new Set<string>();
  for (const m of memberships) {
    if (m.assignedRole) {
      for (const rp of m.assignedRole.permissions) {
        codes.add(rp.permission.code);
      }
    }
  }

  return Array.from(codes);
}

/** Permission codes that grant visibility into global stock */
export const GLOBAL_STOCK_VIEW_PERMISSIONS = [
  'global_stock_warehouse.view',
  'global_stock_warehouse.edit',
  'global_stock_financial.view',
  'global_stock_financial.edit',
] as const;

/** Permission codes for edit operations on global stock */
export const GLOBAL_STOCK_EDIT_PERMISSIONS = [
  'global_stock_warehouse.edit',
  'global_stock_financial.edit',
] as const;

/**
 * Returns a list of external instances where the user has at least one
 * global-stock permission via ProjectMember roles.
 */
export async function getAccessibleStockInstances(
  prisma: PrismaService,
  userId: string,
  homeInstanceId: string,
): Promise<
  Array<{
    instanceId: string;
    instanceName: string;
    permissions: string[];
  }>
> {
  const memberships = await prisma.projectMember.findMany({
    where: {
      userId,
      project: { instanceId: { not: homeInstanceId } },
    },
    select: {
      project: {
        select: {
          instanceId: true,
          instance: { select: { name: true } },
        },
      },
      assignedRole: {
        select: {
          permissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      },
    },
  });

  const instanceMap = new Map<string, { name: string; perms: Set<string> }>();
  for (const m of memberships) {
    const iid = m.project.instanceId;
    if (!instanceMap.has(iid)) {
      instanceMap.set(iid, {
        name: m.project.instance.name,
        perms: new Set(),
      });
    }
    const entry = instanceMap.get(iid)!;
    if (m.assignedRole) {
      for (const rp of m.assignedRole.permissions) {
        entry.perms.add(rp.permission.code);
      }
    }
  }

  const stockPerms: string[] = [...GLOBAL_STOCK_VIEW_PERMISSIONS];

  return Array.from(instanceMap.entries())
    .filter(([, v]) => stockPerms.some((p) => v.perms.has(p)))
    .map(([id, v]) => ({
      instanceId: id,
      instanceName: v.name,
      permissions: Array.from(v.perms).filter((p) => stockPerms.includes(p)),
    }));
}
