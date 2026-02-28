import type { StockRequest, StockRequestDelivery } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export const stockRequestApi = {
  async list(params?: {
    projectId?: string;
    status?: string;
    instanceId?: string;
  }): Promise<StockRequest[]> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.status) query.set('status', params.status);
    if (params?.instanceId) query.set('instanceId', params.instanceId);
    const qs = query.toString();

    const res = await fetch(
      `${API_BASE}/stock-requests${qs ? `?${qs}` : ''}`,
      { method: 'GET', credentials: 'include' },
    );
    if (!res.ok) throw new Error('Falha ao carregar requisições de material');
    return res.json();
  },

  async create(input: {
    projectId: string;
    globalStockItemId: string;
    quantity: number;
    notes?: string;
    instanceId?: string;
  }): Promise<StockRequest> {
    const res = await fetch(`${API_BASE}/stock-requests`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao solicitar material');
    }
    return res.json();
  },

  async approve(id: string, instanceId?: string): Promise<StockRequest> {
    const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
    const res = await fetch(`${API_BASE}/stock-requests/${id}/approve${params}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao aprovar requisição');
    }
    return res.json();
  },

  async reject(
    id: string,
    rejectionReason?: string,
    instanceId?: string,
  ): Promise<StockRequest> {
    const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
    const res = await fetch(`${API_BASE}/stock-requests/${id}/reject${params}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionReason, instanceId }),
    });
    if (!res.ok) throw new Error('Falha ao rejeitar requisição');
    return res.json();
  },

  async deliver(
    id: string,
    input: {
      quantity: number;
      notes?: string;
      createPurchaseForRemaining?: boolean;
      instanceId?: string;
    },
  ): Promise<StockRequest> {
    const res = await fetch(`${API_BASE}/stock-requests/${id}/deliver`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao enviar material');
    }
    return res.json();
  },

  async getDeliveries(id: string, instanceId?: string): Promise<StockRequestDelivery[]> {
    const params = instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : '';
    const res = await fetch(`${API_BASE}/stock-requests/${id}/deliveries${params}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao carregar entregas');
    return res.json();
  },

  async cancel(id: string, instanceId?: string): Promise<StockRequest> {
    const res = await fetch(`${API_BASE}/stock-requests/${id}/cancel`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao cancelar envio');
    }
    return res.json();
  },
};
