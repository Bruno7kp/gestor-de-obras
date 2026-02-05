import type { Request } from 'express';

export interface AuthUser {
  sub: string;
  instanceId: string;
  roles: string[];
}

export type AuthenticatedRequest = Request & { user: AuthUser };
