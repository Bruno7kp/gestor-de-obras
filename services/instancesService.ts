const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export type Instance = {
  id: string;
  name: string;
  status?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const instancesService = {
  async list(): Promise<Instance[]> {
    const response = await fetch(`${API_BASE}/instances`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar instancias');
    }

    return response.json();
  },
};
