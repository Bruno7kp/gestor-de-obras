import type { AuditLogEntry, AuditLogListResponse } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

export interface AuditListParams {
  model?: string;
  entityId?: string;
  projectId?: string;
  userId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export const auditApi = {
  async list(params?: AuditListParams): Promise<AuditLogListResponse> {
    const query = new URLSearchParams();
    if (params?.model) query.set('model', params.model);
    if (params?.entityId) query.set('entityId', params.entityId);
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.action) query.set('action', params.action);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.pageSize !== undefined) query.set('pageSize', String(params.pageSize));

    const qs = query.toString();
    const res = await fetch(`${API_BASE}/audit${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Falha ao carregar histórico de auditoria');
    return res.json();
  },

  async findById(id: string): Promise<AuditLogEntry> {
    const res = await fetch(`${API_BASE}/audit/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Entrada de auditoria não encontrada');
    return res.json();
  },

  async distinctModels(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/audit/models`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    return res.json();
  },
};
