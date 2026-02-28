import type { PurchaseRequest } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const purchaseRequestApi = {
  async list(status?: string, instanceId?: string): Promise<PurchaseRequest[]> {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (instanceId) query.set('instanceId', instanceId);
    const qs = query.toString();
    const res = await fetch(`${API_BASE}/purchase-requests${qs ? `?${qs}` : ''}`, {
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
    stockRequestId?: string;
    instanceId?: string;
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

  async markOrdered(id: string, instanceId?: string): Promise<PurchaseRequest> {
    const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
    const res = await fetch(`${API_BASE}/purchase-requests/${id}/order${params}`, {
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
      instanceId?: string;
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

  async cancel(id: string, instanceId?: string): Promise<PurchaseRequest> {
    const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
    const res = await fetch(`${API_BASE}/purchase-requests/${id}/cancel${params}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Falha ao cancelar solicitação');
    return res.json();
  },
};
