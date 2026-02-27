import type { PurchaseRequest } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const purchaseRequestApi = {
  async list(status?: string): Promise<PurchaseRequest[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_BASE}/purchase-requests${query}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao carregar solicitações de compra');
    return res.json();
  },

  async create(input: {
    globalStockItemId: string;
    quantity: number;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    notes?: string;
  }): Promise<PurchaseRequest> {
    const res = await fetch(`${API_BASE}/purchase-requests`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao criar solicitação de compra');
    }
    return res.json();
  },

  async markOrdered(id: string): Promise<PurchaseRequest> {
    const res = await fetch(`${API_BASE}/purchase-requests/${id}/order`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Falha ao marcar pedido como realizado');
    return res.json();
  },

  async complete(
    id: string,
    input: {
      invoiceNumber?: string;
      unitPrice: number;
      supplierId?: string;
    },
  ): Promise<PurchaseRequest> {
    const res = await fetch(`${API_BASE}/purchase-requests/${id}/complete`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao confirmar entrega');
    }
    return res.json();
  },

  async cancel(id: string): Promise<PurchaseRequest> {
    const res = await fetch(`${API_BASE}/purchase-requests/${id}/cancel`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Falha ao cancelar solicitação');
    return res.json();
  },
};
