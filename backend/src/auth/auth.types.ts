import type { Request } from 'express';

export interface AuthUser {
  id: string;
  instanceId: string;
  roles: string[];
}

export type AuthenticatedRequest = Request & { user: AuthUser };
