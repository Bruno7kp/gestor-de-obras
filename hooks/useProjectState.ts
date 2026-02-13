
import { useState, useCallback, useEffect, useRef } from 'react';
import { Project, ProjectGroup, GlobalSettings, BiddingProcess, Supplier, CompanyCertificate, JournalEntry, ExternalProject } from '../types';
import { journalService } from '../services/journalService';
import { journalApi } from '../services/journalApi';
import { projectsApi, normalizeProject } from '../services/projectsApi';
import { projectGroupsApi } from '../services/projectGroupsApi';
import { suppliersApi } from '../services/suppliersApi';
import { biddingsApi } from '../services/biddingsApi';
import { globalSettingsApi } from '../services/globalSettingsApi';

interface State {
  projects: Project[];
  externalProjects: ExternalProject[];
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
  userName: 'Usuário',
  language: 'pt-BR',
  currencySymbol: 'R$',
  certificates: []
};

const MAX_HISTORY = 20;

export const useProjectState = () => {
  const [present, setPresent] = useState<State>(() => ({
    projects: [],
    externalProjects: [],
    biddings: [],
    groups: [],
    suppliers: [],
    activeProjectId: null,
    activeBiddingId: null,
    globalSettings: INITIAL_SETTINGS,
  }));

  const loadedProjectIdsRef = useRef<Set<string>>(new Set());

  const [past, setPast] = useState<State[]>([]);
  const [future, setFuture] = useState<State[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [projectsResult, groupsResult, suppliersResult, biddingsResult, settingsResult, externalResult] = await Promise.allSettled([
          projectsApi.list(),
          projectGroupsApi.list(),
          suppliersApi.list(),
          biddingsApi.list(),
          globalSettingsApi.get(),
          projectsApi.listExternal(),
        ]);

        const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
        const groups = groupsResult.status === 'fulfilled' ? groupsResult.value : [];
        const suppliers = suppliersResult.status === 'fulfilled' ? suppliersResult.value : [];
        const biddings = biddingsResult.status === 'fulfilled' ? biddingsResult.value : [];
        const globalSettings = settingsResult.status === 'fulfilled' ? settingsResult.value : INITIAL_SETTINGS;
        const externalProjects = externalResult.status === 'fulfilled' ? externalResult.value : [];

        if (!isMounted) return;

        setPresent(prev => {
          const activeProjectId = projects.some(p => p.id === prev.activeProjectId)
            ? prev.activeProjectId
            : null;

          const mergedProjects = projects.map((project) => {
            const existing = prev.projects.find(p => p.id === project.id);
            if (!existing) return project;

            const hasDetails =
              (existing.items?.length ?? 0) > 0 ||
              (existing.expenses?.length ?? 0) > 0 ||
              (existing.assets?.length ?? 0) > 0 ||
              (existing.history?.length ?? 0) > 0 ||
              (existing.workforce?.length ?? 0) > 0 ||
              (existing.laborContracts?.length ?? 0) > 0 ||
              (existing.journal?.entries?.length ?? 0) > 0 ||
              (existing.planning?.tasks?.length ?? 0) > 0 ||
              (existing.planning?.forecasts?.length ?? 0) > 0 ||
              (existing.planning?.milestones?.length ?? 0) > 0;

            return hasDetails ? { ...project, ...existing } : project;
          });

          return {
            ...prev,
            projects: mergedProjects,
            externalProjects,
            groups,
            suppliers,
            biddings,
            globalSettings,
            activeProjectId,
          };
        });
      } catch (error) {
        console.error('Falha ao carregar projetos/grupos:', error);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const activeId = present.activeProjectId;
    if (!activeId) return;
    if (loadedProjectIdsRef.current.has(activeId)) return;

    const isExternal = present.externalProjects.some(
      (ep) => ep.projectId === activeId,
    );

    let isMounted = true;
    const loadProject = async () => {
      try {
        let project: Project;

        if (isExternal) {
          try {
            project = await projectsApi.getExternal(activeId);
          } catch {
            project = await projectsApi.get(activeId);
          }
        } else {
          try {
            project = await projectsApi.get(activeId);
          } catch {
            project = await projectsApi.getExternal(activeId);
          }
        }

        if (!isMounted) return;

        loadedProjectIdsRef.current.add(activeId);
        setPresent(prev => {
          const exists = prev.projects.some(p => p.id === project.id);
          const updatedProjects = exists
            ? prev.projects.map(p => (p.id === project.id ? normalizeProject(project) : p))
            : [...prev.projects, normalizeProject(project)];
          return { ...prev, projects: updatedProjects };
        });
      } catch (error) {
        console.error('Falha ao carregar projeto:', error);
      }
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [present.activeProjectId, present.externalProjects]);

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
    let autoLogsToSync: JournalEntry[] = [];
    let projectId: string | null = null;

    commit(prev => {
      const activeIdx = prev.projects.findIndex(p => p.id === prev.activeProjectId);
      if (activeIdx === -1) return prev;

      const active = prev.projects[activeIdx];
      let autoLogs: JournalEntry[] = [];
      if (data.expenses) autoLogs = [...autoLogs, ...journalService.checkExpenseStatusDeltas(active.expenses, data.expenses)];
      if (data.items) autoLogs = [...autoLogs, ...journalService.checkWorkItemDeltas(active.items, data.items)];
      autoLogsToSync = autoLogs;
      projectId = active.id;

      const baseEntries = data.journal?.entries ?? active.journal.entries;
      const updatedProject: Project = {
        ...active,
        ...data,
        journal: {
          ...active.journal,
          ...(data.journal ?? {}),
          entries: autoLogs.length > 0 ? [...autoLogs, ...baseEntries] : baseEntries
        }
      };

      const updatedProjects = [...prev.projects];
      updatedProjects[activeIdx] = updatedProject;
      return { ...prev, projects: updatedProjects };
    });

    if (autoLogsToSync.length > 0 && projectId) {
      void Promise.all(autoLogsToSync.map((entry) => journalApi.create(projectId as string, entry)))
        .catch((error) => {
          console.error('Erro ao sincronizar registros automaticos:', error);
        });
    }
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
    setGlobalSettings: (s: GlobalSettings) => {
      commit(prev => ({ ...prev, globalSettings: s }));
      void globalSettingsApi.update(s).catch((error) => {
        console.error('Falha ao atualizar configuracoes globais:', error);
      });
    },
    bulkUpdate: (updates: Partial<State>) => commit(prev => ({ ...prev, ...updates }))
  };
};
