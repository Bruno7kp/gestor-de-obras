
import { useState, useCallback, useEffect } from 'react';
import { Project, ProjectGroup, MeasurementSnapshot, GlobalSettings, ProjectPlanning, ProjectJournal, WorkItem, ProjectExpense, BiddingProcess, CompanyCertificate, DEFAULT_THEME } from '../types';
import { treeService } from '../services/treeService';
import { journalService } from '../services/journalService';
import { financial } from '../utils/math';

interface State {
  projects: Project[];
  biddings: BiddingProcess[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  activeBiddingId: string | null;
  globalSettings: GlobalSettings;
}

const INITIAL_SETTINGS: GlobalSettings = {
  defaultCompanyName: 'Sua Empresa de Engenharia',
  companyCnpj: '',
  userName: 'Usuário ProMeasure',
  language: 'pt-BR',
  certificates: []
};

const INITIAL_PLANNING: ProjectPlanning = {
  tasks: [],
  forecasts: [],
  milestones: []
};

const INITIAL_JOURNAL: ProjectJournal = {
  entries: []
};

export const useProjectState = () => {
  const [past, setPast] = useState<State[]>([]);
  const [present, setPresent] = useState<State>(() => {
    const saved = localStorage.getItem('promeasure_v4_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        projects: (parsed.projects || []).map((p: any) => ({
          ...p,
          location: p.location || '',
          planning: p.planning || { ...INITIAL_PLANNING },
          journal: p.journal || { ...INITIAL_JOURNAL },
          // Migração profunda do tema para evitar erro de undefined em propriedades novas
          theme: {
            ...DEFAULT_THEME,
            ...(p.theme || {}),
            header: { ...DEFAULT_THEME.header, ...(p.theme?.header || {}) },
            category: { ...DEFAULT_THEME.category, ...(p.theme?.category || {}) },
            footer: { ...DEFAULT_THEME.footer, ...(p.theme?.footer || {}) },
            kpiHighlight: { ...DEFAULT_THEME.kpiHighlight, ...(p.theme?.kpiHighlight || {}) }
          }
        })),
        biddings: parsed.biddings || [],
        globalSettings: parsed.globalSettings || INITIAL_SETTINGS
      };
    }
    return {
      projects: [],
      biddings: [],
      groups: [],
      activeProjectId: null,
      activeBiddingId: null,
      globalSettings: INITIAL_SETTINGS
    };
  });
  const [future, setFuture] = useState<State[]>([]);

  useEffect(() => {
    localStorage.setItem('promeasure_v4_data', JSON.stringify(present));
  }, [present]);

  const bulkUpdate = useCallback((updates: Partial<State> | ((prev: State) => Partial<State>)) => {
    setPresent(prev => {
      const resolvedUpdates = typeof updates === 'function' ? updates(prev) : updates;
      setPast(p => [...p, prev].slice(-20));
      setFuture([]);
      return { ...prev, ...resolvedUpdates };
    });
  }, []);

  const updateActiveProject = useCallback((data: Partial<Project>) => {
    setPresent(prev => {
      const activeProject = prev.projects.find(p => p.id === prev.activeProjectId);
      if (!activeProject) return prev;
      const updatedProjects = prev.projects.map(p => p.id === prev.activeProjectId ? { ...p, ...data } : p);
      return { ...prev, projects: updatedProjects };
    });
  }, []);

  const updateProjects = useCallback((projects: Project[]) => {
    bulkUpdate({ projects });
  }, [bulkUpdate]);
  
  const updateGroups = useCallback((groups: ProjectGroup[]) => {
    bulkUpdate({ groups });
  }, [bulkUpdate]);
  
  const updateBiddings = useCallback((biddings: BiddingProcess[]) => {
    bulkUpdate({ biddings });
  }, [bulkUpdate]);
  
  const updateCertificates = useCallback((certs: CompanyCertificate[]) => {
    bulkUpdate(prev => ({ globalSettings: { ...prev.globalSettings, certificates: certs } }));
  }, [bulkUpdate]);

  return {
    ...present,
    activeProject: present.projects.find(p => p.id === present.activeProjectId) || null,
    activeBidding: present.biddings.find(b => b.id === present.activeBiddingId) || null,
    setGlobalSettings: (s: GlobalSettings) => bulkUpdate({ globalSettings: s }),
    setActiveProjectId: (id: string | null) => setPresent(prev => ({ ...prev, activeProjectId: id, activeBiddingId: null })),
    setActiveBiddingId: (id: string | null) => setPresent(prev => ({ ...prev, activeBiddingId: id, activeProjectId: null })),
    updateActiveProject,
    updateProjects,
    updateGroups,
    updateBiddings,
    updateCertificates,
    bulkUpdate,
    undo: () => {}, redo: () => {}, canUndo: false, canRedo: false 
  };
};
