
import { useState, useCallback, useEffect } from 'react';
import { Project, ProjectGroup, GlobalSettings, WorkItem, ProjectExpense, BiddingProcess, Supplier } from '../types';
import { journalService } from '../services/journalService';

interface State {
  projects: Project[];
  biddings: BiddingProcess[];
  groups: ProjectGroup[];
  suppliers: Supplier[];
  activeProjectId: string | null;
  activeBiddingId: string | null;
  globalSettings: GlobalSettings;
}

const INITIAL_SETTINGS: GlobalSettings = {
  defaultCompanyName: 'Sua Empresa de Engenharia',
  companyCnpj: '',
  userName: 'Usuário ProMeasure',
  language: 'pt-BR',
  currencySymbol: 'R$',
  certificates: []
};

export const useProjectState = () => {
  const [present, setPresent] = useState<State>(() => {
    const saved = localStorage.getItem('promeasure_v4_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        projects: (parsed.projects || []).map((p: any) => ({
          ...p,
          workforce: p.workforce || [],
          expenses: (p.expenses || []).map((e: any) => ({
            ...e,
            status: e.status || (e.isPaid ? 'PAID' : 'PENDING')
          }))
        }))
      };
    }
    return { projects: [], biddings: [], groups: [], suppliers: [], activeProjectId: null, activeBiddingId: null, globalSettings: INITIAL_SETTINGS };
  });

  useEffect(() => {
    localStorage.setItem('promeasure_v4_data', JSON.stringify(present));
  }, [present]);

  /**
   * Atualiza o projeto ativo preservando a imutabilidade absoluta.
   * COMPLIANCE: Intercepta mudanças para gerar logs automáticos no diário.
   */
  const updateActiveProject = useCallback((data: Partial<Project>) => {
    setPresent(prev => {
      const activeIdx = prev.projects.findIndex(p => p.id === prev.activeProjectId);
      if (activeIdx === -1) return prev;

      const active = prev.projects[activeIdx];
      let autoLogs: any[] = [];

      // 1. Detectar mudanças de status em despesas (Suprimentos)
      if (data.expenses) {
        autoLogs = [...autoLogs, ...journalService.checkExpenseStatusDeltas(active.expenses, data.expenses)];
      }

      // 2. Detectar conclusões na EAP (Físico)
      if (data.items) {
        autoLogs = [...autoLogs, ...journalService.checkWorkItemDeltas(active.items, data.items)];
      }

      // Construir o novo estado do projeto
      const updatedProject: Project = { 
        ...active, 
        ...data,
        journal: {
          ...active.journal,
          // Insere novos logs no topo da lista se houverem deltas
          entries: autoLogs.length > 0 
            ? [...autoLogs, ...active.journal.entries] 
            : active.journal.entries
        }
      };

      const updatedProjects = [...prev.projects];
      updatedProjects[activeIdx] = updatedProject;

      return { ...prev, projects: updatedProjects };
    });
  }, []);

  return {
    ...present,
    activeProject: present.projects.find(p => p.id === present.activeProjectId) || null,
    updateActiveProject,
    setActiveProjectId: (id: string | null) => setPresent(prev => ({ ...prev, activeProjectId: id })),
    updateProjects: (projects: Project[]) => setPresent(prev => ({ ...prev, projects })),
    updateGroups: (groups: ProjectGroup[]) => setPresent(prev => ({ ...prev, groups })),
    updateSuppliers: (suppliers: Supplier[]) => setPresent(prev => ({ ...prev, suppliers })),
    updateBiddings: (biddings: BiddingProcess[]) => setPresent(prev => ({ ...prev, biddings })),
    updateCertificates: (certs: any) => setPresent(prev => ({ ...prev, globalSettings: { ...prev.globalSettings, certificates: certs } })),
    setGlobalSettings: (s: GlobalSettings) => setPresent(prev => ({ ...prev, globalSettings: s })),
    bulkUpdate: (updates: any) => setPresent(prev => ({ ...prev, ...updates }))
  };
};
