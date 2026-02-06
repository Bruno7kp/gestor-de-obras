import type { StaffDocument, WorkforceMember } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type WorkforceInput = Omit<WorkforceMember, 'id' | 'documentos' | 'linkedWorkItemIds'> & {
  documentos?: StaffDocument[];
  linkedWorkItemIds?: string[];
};

type WorkforcePatch = Partial<WorkforceInput>;

type WorkforceResponse = WorkforceMember & {
  documentos?: StaffDocument[];
  responsabilidades?: Array<{ workItemId: string }>;
};

const normalizeMember = (input: WorkforceResponse): WorkforceMember => ({
  id: input.id,
  nome: input.nome ?? '',
  cpf_cnpj: input.cpf_cnpj ?? '',
  empresa_vinculada: input.empresa_vinculada ?? '',
  foto: input.foto ?? undefined,
  cargo: input.cargo ?? 'Servente',
  documentos: input.documentos ?? [],
  linkedWorkItemIds: input.responsabilidades?.map((resp) => resp.workItemId) ?? input.linkedWorkItemIds ?? [],
});

export const workforceApi = {
  async list(projectId: string): Promise<WorkforceMember[]> {
    const response = await fetch(`${API_BASE}/workforce-members?projectId=${projectId}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar equipe');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeMember);
  },

  async create(projectId: string, input: WorkforceInput): Promise<WorkforceMember> {
    const response = await fetch(`${API_BASE}/workforce-members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        ...input,
        projectId,
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar colaborador');
    }

    return normalizeMember(await response.json());
  },

  async update(id: string, input: WorkforcePatch): Promise<WorkforceMember> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar colaborador');
    }

    return normalizeMember(await response.json());
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover colaborador');
    }
  },

  async addDocument(id: string, document: StaffDocument): Promise<StaffDocument> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      throw new Error('Falha ao adicionar documento');
    }

    return response.json();
  },

  async removeDocument(id: string, documentId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}/documents/${documentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover documento');
    }
  },

  async addResponsibility(id: string, workItemId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}/responsibilities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ workItemId }),
    });

    if (!response.ok) {
      throw new Error('Falha ao adicionar responsabilidade');
    }
  },

  async removeResponsibility(id: string, workItemId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/workforce-members/${id}/responsibilities/${workItemId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao remover responsabilidade');
    }
  },
};
