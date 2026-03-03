import type { Contractor } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type ContractorInput = Partial<Omit<Contractor, 'id'>> & Pick<Contractor, 'name' | 'type'>;

type ContractorPatch = Partial<Omit<Contractor, 'id'>>;

export const contractorsApi = {
  async list(): Promise<Contractor[]> {
    const response = await fetch(`${API_BASE}/contractors`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar prestadores');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async listByInstance(instanceId: string): Promise<Contractor[]> {
    const response = await fetch(`${API_BASE}/contractors/by-instance/${instanceId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(input: ContractorInput & { instanceId?: string }): Promise<Contractor> {
    const response = await fetch(`${API_BASE}/contractors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar prestador');
    }

    return response.json();
  },

  /**
   * Find or create a contractor by name.
   * Used by the workforce autocomplete to auto-create contractors.
   */
  async ensureByName(name: string): Promise<{ contractor: Contractor; created: boolean }> {
    const response = await fetch(`${API_BASE}/contractors/ensure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error('Falha ao buscar/criar prestador');
    }

    return response.json();
  },

  async update(id: string, input: ContractorPatch & { instanceId?: string }): Promise<Contractor> {
    const response = await fetch(`${API_BASE}/contractors/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar prestador');
    }

    return response.json();
  },

  async batchReorder(items: Array<{ id: string; order: number }>, instanceId?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contractors/batch-reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items, ...(instanceId && { instanceId }) }),
    });

    if (!response.ok) {
      throw new Error('Falha ao reordenar prestadores');
    }
  },

  async remove(id: string, instanceId?: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contractors/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      ...(instanceId && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao remover prestador');
    }
  },
};
