import type {
  NotificationDigestPreview,
  NotificationPreference,
  UserNotification,
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

interface UpsertNotificationPreferenceInput {
  projectId?: string | null;
  category: string;
  eventType?: string;
  channelInApp?: boolean;
  channelEmail?: boolean;
  frequency?: 'immediate' | 'digest' | 'off';
  minPriority?: 'low' | 'normal' | 'high' | 'critical';
  isEnabled?: boolean;
}

export const notificationsApi = {
  async list(params?: {
    projectId?: string;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<UserNotification[]> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.unreadOnly !== undefined) {
      query.set('unreadOnly', String(params.unreadOnly));
    }
    if (params?.limit) query.set('limit', String(params.limit));

    const response = await fetch(
      `${API_BASE}/notifications${query.toString() ? `?${query.toString()}` : ''}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Falha ao carregar notificacoes');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async markRead(id: string) {
    const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao marcar notificacao como lida');
    }

    return response.json();
  },

  async markAllRead(projectId?: string) {
    const response = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) {
      throw new Error('Falha ao marcar notificacoes como lidas');
    }

    return response.json();
  },

  async remove(id: string) {
    const response = await fetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover notificacao');
    }

    return response.json();
  },

  async listPreferences(projectId?: string): Promise<NotificationPreference[]> {
    const query = new URLSearchParams();
    if (projectId) query.set('projectId', projectId);

    const response = await fetch(
      `${API_BASE}/notifications/preferences${query.toString() ? `?${query.toString()}` : ''}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Falha ao carregar preferencias de notificacao');
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  async upsertPreference(input: UpsertNotificationPreferenceInput) {
    const response = await fetch(`${API_BASE}/notifications/preferences`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar preferencia de notificacao');
    }

    return response.json() as Promise<NotificationPreference>;
  },

  async digestPreview(params?: {
    projectId?: string;
    windowMinutes?: number;
    unreadOnly?: boolean;
    limitGroups?: number;
  }): Promise<NotificationDigestPreview> {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.windowMinutes) {
      query.set('windowMinutes', String(params.windowMinutes));
    }
    if (params?.unreadOnly !== undefined) {
      query.set('unreadOnly', String(params.unreadOnly));
    }
    if (params?.limitGroups) {
      query.set('limitGroups', String(params.limitGroups));
    }

    const response = await fetch(
      `${API_BASE}/notifications/digest-preview${query.toString() ? `?${query.toString()}` : ''}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    );

    if (!response.ok) {
      throw new Error('Falha ao gerar preview de digest');
    }

    return response.json() as Promise<NotificationDigestPreview>;
  },
};
