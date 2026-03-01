import type { Supplier } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type SupplierInput = Omit<Supplier, 'id'>;

type SupplierPatch = Partial<Omit<Supplier, 'id'>>;

export const suppliersApi = {
  async list(): Promise<Supplier[]> {
    const response = await fetch(`${API_BASE}/suppliers`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar fornecedores');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async listByInstance(instanceId: string): Promise<Supplier[]> {
    const response = await fetch(`${API_BASE}/suppliers/by-instance/${instanceId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async create(input: SupplierInput): Promise<Supplier> {
    const response = await fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar fornecedor');
    }

    return response.json();
  },

  async update(id: string, input: SupplierPatch): Promise<Supplier> {
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar fornecedor');
    }

    return response.json();
  },

  async batchReorder(items: Array<{ id: string; order: number }>): Promise<void> {
    const response = await fetch(`${API_BASE}/suppliers/batch-reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error('Falha ao reordenar fornecedores');
    }
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover fornecedor');
    }
  },
};
