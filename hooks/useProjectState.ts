
import { useState, useCallback, useEffect } from 'react';
import { Project, WorkItem, MeasurementSnapshot, DEFAULT_THEME, GlobalSettings, ProjectGroup } from '../types';
import { treeService } from '../services/treeService';

interface State {
  projects: Project[];
  groups: ProjectGroup[];
  activeProjectId: string | null;
  globalSettings: GlobalSettings;
}

const INITIAL_SETTINGS: GlobalSettings = {
  defaultCompanyName: 'Sua Empresa de Engenharia',
  userName: 'Usuário ProMeasure',
  language: 'pt-BR'
};

export const useProjectState = () => {
  const [past, setPast] = useState<State[]>([]);
  const [present, setPresent] = useState<State>(() => {
    const saved = localStorage.getItem('promeasure_v4_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        groups: parsed.groups || [],
        projects: parsed.projects.map((p: any) => ({
          ...p,
          groupId: p.groupId || null,
          assets: p.assets || [],
          expenses: p.expenses || []
        })),
        globalSettings: parsed.globalSettings || INITIAL_SETTINGS
      };
    }
    
    return {
      projects: [],
      groups: [],
      activeProjectId: null,
      globalSettings: INITIAL_SETTINGS
    };
  });
  const [future, setFuture] = useState<State[]>([]);

  useEffect(() => {
    localStorage.setItem('promeasure_v4_data', JSON.stringify(present));
  }, [present]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const saveHistory = useCallback((newState: State) => {
    setPast(prev => [...prev, present].slice(-20));
    setPresent(newState);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    const previous = past[past.length - 1];
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
    setPast(past.slice(0, past.length - 1));
  }, [canUndo, past, present]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = future[0];
    setPast(prev => [...prev, present]);
    setPresent(next);
    setFuture(future.slice(1));
  }, [canRedo, future, present]);

  const updateProjects = useCallback((newProjects: Project[]) => {
    saveHistory({ ...present, projects: newProjects });
  }, [present, saveHistory]);

  const updateGroups = useCallback((newGroups: ProjectGroup[]) => {
    saveHistory({ ...present, groups: newGroups });
  }, [present, saveHistory]);

  const updateActiveProject = useCallback((data: Partial<Project>) => {
    const newProjects = present.projects.map(p => 
      p.id === present.activeProjectId ? { ...p, ...data } : p
    );
    updateProjects(newProjects);
  }, [present, updateProjects]);

  const finalizeMeasurement = useCallback(() => {
    const activeProject = present.projects.find(p => p.id === present.activeProjectId);
    if (!activeProject) return;

    const stats = treeService.calculateBasicStats(activeProject.items, activeProject.bdi);
    const tree = treeService.buildTree(activeProject.items);
    const processedTree = tree.map((r, i) => treeService.processRecursive(r, '', i, activeProject.bdi));
    const processedItemsFlat = treeService.flattenTree(processedTree, new Set(activeProject.items.map(i => i.id)));

    const snapshot: MeasurementSnapshot = {
      measurementNumber: activeProject.measurementNumber,
      date: activeProject.referenceDate || new Date().toLocaleDateString('pt-BR'),
      items: JSON.parse(JSON.stringify(processedItemsFlat)),
      totals: {
        contract: stats.contract,
        period: stats.current,
        accumulated: stats.accumulated,
        progress: stats.progress
      }
    };

    const nextPeriodItems = activeProject.items.map(item => {
      if (item.type === 'item') {
        return {
          ...item,
          previousQuantity: (item.previousQuantity || 0) + (item.currentQuantity || 0),
          previousTotal: (item.previousTotal || 0) + (item.currentTotal || 0),
          currentQuantity: 0,
          currentTotal: 0,
          currentPercentage: 0
        };
      }
      return item;
    });

    updateActiveProject({
      items: nextPeriodItems,
      history: [...(activeProject.history || []), snapshot],
      measurementNumber: (activeProject.measurementNumber || 1) + 1,
      referenceDate: new Date().toLocaleDateString('pt-BR')
    });
  }, [present, updateActiveProject]);

  return {
    projects: present.projects,
    groups: present.groups,
    activeProjectId: present.activeProjectId,
    activeProject: present.projects.find(p => p.id === present.activeProjectId) || null,
    globalSettings: present.globalSettings,
    setGlobalSettings: (s: GlobalSettings) => saveHistory({ ...present, globalSettings: s }),
    setActiveProjectId: (id: string | null) => setPresent(prev => ({ ...prev, activeProjectId: id })),
    updateActiveProject,
    updateProjects,
    updateGroups,
    finalizeMeasurement,
    undo, redo, canUndo, canRedo
  };
};
