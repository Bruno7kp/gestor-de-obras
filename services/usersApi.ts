import type { Role, UserAccount } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

const normalizeRole = (input: any): Role => ({
  id: input?.id ?? '',
  name: input?.name ?? '',
  description: input?.description ?? null,
  instanceId: input?.instanceId ?? undefined,
});

const normalizeUser = (input: any): UserAccount => ({
  id: input?.id ?? '',
  name: input?.name ?? '',
  email: input?.email ?? '',
  status: input?.status ?? undefined,
  instanceId: input?.instanceId ?? undefined,
  profileImage: input?.profileImage ?? null,
  roles: Array.isArray(input?.roles)
    ? input.roles.map((entry: any) => normalizeRole(entry?.role ?? entry))
    : [],
});

export const usersApi = {
  async list(): Promise<UserAccount[]> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar usuarios');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeUser);
  },

  async me(): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar usuario');
    }

    return normalizeUser(await response.json());
  },

  async updateMe(input: { name?: string; email?: string; profileImage?: string | null }): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      if (response.status === 413) {
        throw new Error('Arquivo muito grande. A imagem deve ser menor que 500KB.');
      }
      throw new Error('Falha ao atualizar perfil');
    }

    return normalizeUser(await response.json());
  },

  async updateMePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    const response = await fetch(`${API_BASE}/users/me/password`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar senha');
    }
  },

  async setRoles(userId: string, roleIds: string[]): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users/${userId}/roles`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ roleIds }),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar roles');
    }

    return normalizeUser(await response.json());
  },

  async create(input: { name: string; email: string; password: string; roleIds?: string[] }): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar usuario');
    }

    return normalizeUser(await response.json());
  },

  async updateUser(userId: string, input: { name?: string; email?: string; password?: string }): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar usuario');
    }

    return normalizeUser(await response.json());
  },

  async toggleStatus(userId: string): Promise<UserAccount> {
    const response = await fetch(`${API_BASE}/users/${userId}/toggle-status`, {
      method: 'PATCH',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao alterar status do usuario');
    }

    return normalizeUser(await response.json());
  },
};
