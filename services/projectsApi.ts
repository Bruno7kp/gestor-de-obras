import { DEFAULT_THEME, type ExternalProject, type LaborContract, type Project, type ProjectExpense, type WorkforceMember } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type ProjectConfig = {
  strict: boolean;
  printCards: boolean;
  printSubtotals: boolean;
  showSignatures: boolean;
};

const normalizeExpenses = (expenses: ProjectExpense[] | undefined) =>
  (expenses ?? []).map((expense) => ({
    ...expense,
    status: expense.status || (expense.isPaid ? 'PAID' : 'PENDING'),
  }));

const normalizeWorkforce = (workforce: any[] | undefined): WorkforceMember[] =>
  (workforce ?? []).map((member) => ({
    id: member.id,
    nome: member.nome ?? '',
    cpf_cnpj: member.cpf_cnpj ?? '',
    empresa_vinculada: member.empresa_vinculada ?? '',
    foto: member.foto ?? undefined,
    cargo: member.cargo ?? 'Servente',
    documentos: member.documentos ?? [],
    linkedWorkItemIds: member.responsabilidades?.map((resp: any) => resp.workItemId) ?? [],
  }));

const normalizeLaborContracts = (contracts: any[] | undefined): LaborContract[] =>
  (contracts ?? []).map((contract) => ({
    id: contract.id,
    tipo: contract.tipo,
    descricao: contract.descricao,
    associadoId: contract.associadoId,
    valorTotal: contract.valorTotal,
    valorPago: contract.valorPago ?? 0,
    status: contract.status ?? 'pendente',
    dataInicio: contract.dataInicio,
    dataFim: contract.dataFim ?? undefined,
    linkedWorkItemId: contract.linkedWorkItemId ?? contract.linkedWorkItemIds?.[0] ?? undefined,
    linkedWorkItemIds: contract.linkedWorkItemIds ?? contract.linkedWorkItems?.map((item: any) => item.workItemId) ?? (contract.linkedWorkItemId ? [contract.linkedWorkItemId] : []),
    observacoes: contract.observacoes ?? undefined,
    ordem: contract.ordem ?? 0,
    pagamentos: contract.pagamentos ?? [],
  }));

const normalizeTheme = (theme: any) => {
  if (!theme) return { ...DEFAULT_THEME };

  if (theme.headerBg || theme.kpiBg || theme.footerBg) {
    return {
      primary: theme.primary ?? DEFAULT_THEME.primary,
      accent: theme.accent ?? DEFAULT_THEME.accent,
      accentText: theme.accentText ?? DEFAULT_THEME.accentText,
      border: theme.border ?? DEFAULT_THEME.border,
      fontFamily: theme.fontFamily ?? DEFAULT_THEME.fontFamily,
      currencySymbol: theme.currencySymbol ?? DEFAULT_THEME.currencySymbol,
      header: { bg: theme.headerBg ?? DEFAULT_THEME.header.bg, text: theme.headerText ?? DEFAULT_THEME.header.text },
      category: { bg: theme.categoryBg ?? DEFAULT_THEME.category.bg, text: theme.categoryText ?? DEFAULT_THEME.category.text },
      footer: { bg: theme.footerBg ?? DEFAULT_THEME.footer.bg, text: theme.footerText ?? DEFAULT_THEME.footer.text },
      kpiHighlight: { bg: theme.kpiBg ?? DEFAULT_THEME.kpiHighlight.bg, text: theme.kpiText ?? DEFAULT_THEME.kpiHighlight.text },
    };
  }

  return {
    primary: theme.primary ?? DEFAULT_THEME.primary,
    accent: theme.accent ?? DEFAULT_THEME.accent,
    accentText: theme.accentText ?? DEFAULT_THEME.accentText,
    border: theme.border ?? DEFAULT_THEME.border,
    fontFamily: theme.fontFamily ?? DEFAULT_THEME.fontFamily,
    currencySymbol: theme.currencySymbol ?? DEFAULT_THEME.currencySymbol,
    header: { bg: theme.header?.bg ?? DEFAULT_THEME.header.bg, text: theme.header?.text ?? DEFAULT_THEME.header.text },
    category: { bg: theme.category?.bg ?? DEFAULT_THEME.category.bg, text: theme.category?.text ?? DEFAULT_THEME.category.text },
    footer: { bg: theme.footer?.bg ?? DEFAULT_THEME.footer.bg, text: theme.footer?.text ?? DEFAULT_THEME.footer.text },
    kpiHighlight: { bg: theme.kpiHighlight?.bg ?? DEFAULT_THEME.kpiHighlight.bg, text: theme.kpiHighlight?.text ?? DEFAULT_THEME.kpiHighlight.text },
  };
};

export const normalizeProject = (project: any): Project => {
  const config: ProjectConfig = {
    strict: project.config?.strict ?? project.strict ?? false,
    printCards: project.config?.printCards ?? project.printCards ?? true,
    printSubtotals: project.config?.printSubtotals ?? project.printSubtotals ?? true,
    showSignatures: project.config?.showSignatures ?? project.showSignatures ?? true,
  };

  const history = (project.history ?? []).map((snapshot: any) => ({
    measurementNumber: snapshot.measurementNumber,
    date: snapshot.date,
    items: snapshot.items ?? snapshot.itemsSnapshot ?? [],
    totals: snapshot.totals ?? {},
  })).sort((a, b) => (b.measurementNumber ?? 0) - (a.measurementNumber ?? 0));

  return {
    id: project.id,
    groupId: project.groupId ?? null,
    order: project.order ?? 0,
    progress: project.progress ?? undefined,
    name: project.name ?? 'Nova Obra',
    companyName: project.companyName ?? '',
    companyCnpj: project.companyCnpj ?? '',
    location: project.location ?? '',
    measurementNumber: project.measurementNumber ?? 1,
    referenceDate: project.referenceDate ?? new Date().toLocaleDateString('pt-BR'),
    logo: project.logo ?? null,
    items: project.items ?? [],
    history,
    theme: normalizeTheme(project.theme),
    bdi: project.bdi ?? 25,
    assets: (project.assets ?? []).map((asset: any) => ({
      ...asset,
      category: asset.category ?? 'DOCUMENTO_DIVERSO',
      createdBy: asset.createdBy ?? null,
    })),
    expenses: normalizeExpenses(project.expenses),
    workforce: normalizeWorkforce(project.workforce),
    laborContracts: normalizeLaborContracts(project.laborContracts),
    planning: project.planning ?? { tasks: [], forecasts: [], milestones: [] },
    journal: project.journal ?? { entries: [] },
    contractTotalOverride: project.contractTotalOverride ?? null,
    currentTotalOverride: project.currentTotalOverride ?? null,
    config,
  } as Project;
};

export const projectsApi = {
  async list(): Promise<Project[]> {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar projetos');
    }

    const data = await response.json();
    return (Array.isArray(data) ? data : []).map(normalizeProject);
  },

  async get(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar projeto');
    }

    const data = await response.json();
    return normalizeProject(data);
  },

  async create(input: { name: string; companyName: string; groupId?: string | null }): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao criar projeto');
    }

    return normalizeProject(await response.json());
  },

  async update(id: string, input: Partial<Project> & { groupId?: string | null }): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Falha ao atualizar projeto');
    }

    return normalizeProject(await response.json());
  },

  async remove(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao excluir projeto');
    }
  },

  async listExternal(): Promise<ExternalProject[]> {
    const response = await fetch(`${API_BASE}/projects/external`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar projetos externos');
    }

    return response.json();
  },

  async getExternal(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects/external/${id}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Falha ao carregar projeto externo');
    }

    return normalizeProject(await response.json());
  },
};
