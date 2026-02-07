import type { Permission, Role } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

const normalizePermission = (input: any): Permission => ({
  id: input?.id ?? input?.permission?.id ?? '',
  code: input?.code ?? input?.permission?.code ?? '',
  description: input?.description ?? input?.permission?.description ?? null,
});

const normalizeRole = (input: any): Role => ({
  id: input?.id ?? '',
  name: input?.name ?? '',
  description: input?.description ?? null,
  instanceId: input?.instanceId ?? undefined,
  permissions: Array.isArray(input?.permissions)
    ? input.permissions.map((entry: any) => normalizePermission(entry?.permission ?? entry))
    : [],
});

export const rolesApi = {
  async list(): Promise<Role[]> {
    const response = await fetch(`${API_BASE}/roles`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar roles');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeRole);
  },

  async create(input: { name: string; description?: string }): Promise<Role> {
    const response = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar role');
    }

    return normalizeRole(await response.json());
  },

  async update(id: string, input: { name?: string; description?: string }): Promise<Role> {
    const response = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar role');
    }

    return normalizeRole(await response.json());
  },

  async setPermissions(id: string, codes: string[]): Promise<Role> {
    const response = await fetch(`${API_BASE}/roles/${id}/permissions`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ codes }),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar permissoes');
    }

    return normalizeRole(await response.json());
  },

  async resetDefaults(): Promise<Role[]> {
    const response = await fetch(`${API_BASE}/roles/reset-defaults`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao resetar roles');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeRole);
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover role');
    }
  },
};
