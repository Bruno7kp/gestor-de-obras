
import { useState, useCallback, useEffect } from 'react';
import { Project, ProjectGroup, GlobalSettings, BiddingProcess, Supplier, CompanyCertificate } from '../types';
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

const MAX_HISTORY = 20;

export const useProjectState = () => {
  const [present, setPresent] = useState<State>(() => {
    const saved = localStorage.getItem('promeasure_v4_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          projects: (parsed.projects || []).map((p: any) => ({
            ...p,
            workforce: p.workforce || [],
            laborContracts: p.laborContracts || [], // Garantia de inicialização
            expenses: (p.expenses || []).map((e: any) => ({
              ...e,
              status: e.status || (e.isPaid ? 'PAID' : 'PENDING')
            }))
          }))
        };
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
      }
    }
    return { projects: [], biddings: [], groups: [], suppliers: [], activeProjectId: null, activeBiddingId: null, globalSettings: INITIAL_SETTINGS };
  });

  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('promeasure_v4_data', JSON.stringify(present));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert("CRÍTICO: Limite excedido! Remova fotos ou obras antigas.");
      }
    }
  }, [present]);

  const commit = useCallback((updater: (prev: State) => State) => {
    setPresent(prev => {
      const next = updater(prev);
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;

      setPast(pastPrev => [...pastPrev, prev].slice(-MAX_HISTORY));
      setFuture([]);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPresent(prev => {
      if (past.length === 0) return prev;
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      setFuture(f => [prev, ...f].slice(0, MAX_HISTORY));
      setPast(newPast);
      return previous;
    });
  }, [past]);

  const redo = useCallback(() => {
    setPresent(prev => {
      if (future.length === 0) return prev;
      const next = future[0];
      const newFuture = future.slice(1);
      setPast(p => [...p, prev].slice(-MAX_HISTORY));
      setFuture(newFuture);
      return next;
    });
  }, [future]);

  const updateActiveProject = useCallback((data: Partial<Project>) => {
    commit(prev => {
      const activeIdx = prev.projects.findIndex(p => p.id === prev.activeProjectId);
      if (activeIdx === -1) return prev;

      const active = prev.projects[activeIdx];
      let autoLogs: any[] = [];
      if (data.expenses) autoLogs = [...autoLogs, ...journalService.checkExpenseStatusDeltas(active.expenses, data.expenses)];
      if (data.items) autoLogs = [...autoLogs, ...journalService.checkWorkItemDeltas(active.items, data.items)];

      const updatedProject: Project = {
        ...active,
        ...data,
        journal: {
          ...active.journal,
          entries: autoLogs.length > 0 ? [...autoLogs, ...active.journal.entries] : active.journal.entries
        }
      };

      const updatedProjects = [...prev.projects];
      updatedProjects[activeIdx] = updatedProject;
      return { ...prev, projects: updatedProjects };
    });
  }, [commit]);

  return {
    ...present,
    activeProject: present.projects.find(p => p.id === present.activeProjectId) || null,
    updateActiveProject,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setActiveProjectId: (id: string | null) => commit(prev => ({ ...prev, activeProjectId: id })),
    updateProjects: (projects: Project[]) => commit(prev => ({ ...prev, projects })),
    updateGroups: (groups: ProjectGroup[]) => commit(prev => ({ ...prev, groups })),
    updateSuppliers: (suppliers: Supplier[]) => commit(prev => ({ ...prev, suppliers })),
    updateBiddings: (biddings: BiddingProcess[]) => commit(prev => ({ ...prev, biddings })),
    updateCertificates: (certificates: CompanyCertificate[]) => commit(prev => ({
      ...prev,
      globalSettings: { ...prev.globalSettings, certificates }
    })),
    setGlobalSettings: (s: GlobalSettings) => commit(prev => ({ ...prev, globalSettings: s })),
    bulkUpdate: (updates: Partial<State>) => commit(prev => ({ ...prev, ...updates }))
  };
};
