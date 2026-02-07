import type { Request } from 'express';

export interface AuthUser {
  id: string;
  instanceId: string;
  instanceName?: string;
  roles: string[];
  permissions?: string[];
}

export type AuthenticatedRequest = Request & { user: AuthUser };
