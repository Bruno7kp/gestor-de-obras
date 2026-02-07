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

  async findById(id: string): Promise<Instance> {
    const response = await fetch(`${API_BASE}/instances/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar instancia');
    }

    return response.json();
  },

  async create(data: {
    name: string;
    status?: string;
    admin?: {
      name: string;
      email: string;
      password: string;
    };
  }): Promise<Instance> {
    const response = await fetch(`${API_BASE}/instances`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar instancia');
    }

    return response.json();
  },

  async update(id: string, data: { name?: string; status?: string }): Promise<Instance> {
    const response = await fetch(`${API_BASE}/instances/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar instancia');
    }

    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/instances/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao deletar instancia');
    }
  },
};
