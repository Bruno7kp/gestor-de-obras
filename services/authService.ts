const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export type AuthUser = {
  id: string;
  name?: string;
  email?: string;
  instanceId: string;
  instanceName?: string;
  roles: string[];
  permissions?: string[];
};

export type LoginInput = {
  email: string;
  password: string;
  instanceId: string;
};

type LoginResponse = {
  user: AuthUser;
  accessToken?: string;
};

export const authService = {
  async login(input: LoginInput): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao autenticar');
    }

    return response.json();
  },

  async me(): Promise<AuthUser | null> {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Falha ao carregar usuario');
    }

    return response.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },
};
