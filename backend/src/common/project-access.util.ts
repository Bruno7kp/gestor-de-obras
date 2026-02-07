import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ensures the user has access to the project.
 * First checks if the project belongs to the user's instance (same-instance).
 * Falls back to checking if the user is a member of the project (cross-instance / external).
 *
 * @throws NotFoundException if access is denied
 */
export async function ensureProjectAccess(
  prisma: PrismaService,
  projectId: string,
  instanceId: string,
  userId?: string,
): Promise<void> {
  // Fast path: project belongs to user's instance
  const sameInstance = await prisma.project.findFirst({
    where: { id: projectId, instanceId },
    select: { id: true },
  });
  if (sameInstance) return;

  // Fallback: user is a member of this project (cross-instance)
  if (userId) {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, user: { id: userId } },
      select: { id: true },
    });
    if (membership) return;
  }

  throw new NotFoundException('Projeto nao encontrado');
}

/**
 * Ensures the user has access to an entity that belongs to a project.
 * Checks both same-instance and cross-instance (project member) access.
 * Returns the entity if found and accessible.
 *
 * @param findFn A function that queries the entity. Called twice:
 *   first with instanceId filter, then without (for member check).
 */
export async function ensureEntityAccess<T>(
  prisma: PrismaService,
  entityId: string,
  instanceId: string,
  userId: string | undefined,
  findByInstance: () => Promise<T | null>,
  findById: () => Promise<
    (T & { projectId?: string; project?: { id: string } }) | null
  >,
): Promise<T> {
  // Fast path: entity belongs to user's instance
  const sameInstance = await findByInstance();
  if (sameInstance) return sameInstance;

  // Fallback: check if entity exists and user is a member of its project
  if (userId) {
    const entity = await findById();
    if (entity) {
      const projectId = entity.projectId ?? entity.project?.id;
      if (projectId) {
        const membership = await prisma.projectMember.findFirst({
          where: { projectId, user: { id: userId } },
          select: { id: true },
        });
        if (membership) return entity;
      }
    }
  }

  throw new NotFoundException('Item nao encontrado');
}
