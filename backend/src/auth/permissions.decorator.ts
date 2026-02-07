import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator para validar permissões específicas de um usuário.
 * Exemplo: @HasPermission('biddings.edit', 'biddings.view')
 *
 * O guard verifica se o usuário tem pelo menos UMA das permissões fornecidas.
 */
export const HasPermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
