
import { useState, useCallback, useEffect } from 'react';
import { Project, WorkItem, MeasurementSnapshot } from '../types';
import { treeService } from '../services/treeService';

interface State {
  projects: Project[];
  activeProjectId: string | null;
}

export const useProjectState = () => {
  const [past, setPast] = useState<State[]>([]);
  const [present, setPresent] = useState<State>(() => {
    const saved = localStorage.getItem('promeasure_v4_projects');
    const parsed = saved ? JSON.parse(saved) : [];
    return {
      projects: parsed,
      activeProjectId: parsed.length > 0 ? parsed[0].id : null,
    };
  });
  const [future, setFuture] = useState<State[]>([]);

  useEffect(() => {
    localStorage.setItem('promeasure_v4_projects', JSON.stringify(present.projects));
  }, [present]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const saveHistory = useCallback((newState: State) => {
    setPast(prev => [...prev, present]);
    setPresent(newState);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (!canUndo) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
    setPast(newPast);
  }, [canUndo, past, present]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    const next = future[0];
    const newFuture = future.slice(1);
    setPast(prev => [...prev, present]);
    setPresent(next);
    setFuture(newFuture);
  }, [canRedo, future, present]);

  const updateProjects = useCallback((newProjects: Project[]) => {
    saveHistory({ ...present, projects: newProjects });
  }, [present, saveHistory]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setPresent(prev => ({ ...prev, activeProjectId: id }));
  }, []);

  const updateActiveProject = useCallback((data: Partial<Project>) => {
    const newProjects = present.projects.map(p => 
      p.id === present.activeProjectId ? { ...p, ...data } : p
    );
    updateProjects(newProjects);
  }, [present, updateProjects]);

  const finalizeMeasurement = useCallback(() => {
    const activeProject = present.projects.find(p => p.id === present.activeProjectId);
    if (!activeProject) return;

    // CRITICAL: Devemos gerar a árvore processada para ter os totais corretos antes de salvar o snapshot
    const tree = treeService.buildTree(activeProject.items);
    const processedTree = tree.map((r, i) => treeService.processRecursive(r, '', i, activeProject.bdi));
    const stats = treeService.calculateBasicStats(activeProject.items, activeProject.bdi);
    
    // Obter lista flat dos itens processados (com WBS e totais calculados)
    const processedItemsFlat = treeService.flattenTree(processedTree, new Set(activeProject.items.map(i => i.id)));

    const snapshot: MeasurementSnapshot = {
      measurementNumber: activeProject.measurementNumber,
      date: activeProject.referenceDate || new Date().toLocaleDateString('pt-BR'),
      items: JSON.parse(JSON.stringify(processedItemsFlat)), // Salva versão calculada
      totals: {
        contract: stats.contract,
        period: stats.current,
        accumulated: stats.accumulated,
        progress: stats.progress
      }
    };

    // Preparar itens para o próximo período
    const nextPeriodItems = activeProject.items.map(item => {
      if (item.type === 'item') {
        return {
          ...item,
          previousQuantity: (item.previousQuantity || 0) + (item.currentQuantity || 0),
          previousTotal: (item.previousTotal || 0) + (item.currentTotal || 0), // Este total será recalculado no próximo processamento se o BDI mudar
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
    activeProjectId: present.activeProjectId,
    activeProject: present.projects.find(p => p.id === present.activeProjectId) || null,
    setActiveProjectId,
    updateActiveProject,
    updateProjects,
    finalizeMeasurement,
    undo,
    redo,
    canUndo,
    canRedo
  };
};
