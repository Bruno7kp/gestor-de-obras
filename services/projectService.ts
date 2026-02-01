import { Project, ProjectGroup, DEFAULT_THEME, MeasurementSnapshot } from '../types';
import { treeService } from './treeService';

/**
 * ProjectService
 * Centraliza a lógica de criação e transformação de entidades de negócio.
 */
export const projectService = {
  /**
   * Fábrica de Projetos (Obras)
   */
  createProject: (name: string, companyName: string, groupId: string | null = null): Project => ({
    id: crypto.randomUUID(),
    groupId,
    name: name.trim() || 'Novo Empreendimento',
    companyName: companyName.trim() || 'Empresa Padrão',
    location: '',
    measurementNumber: 1,
    referenceDate: new Date().toLocaleDateString('pt-BR'),
    logo: null,
    items: [],
    history: [],
    theme: { ...DEFAULT_THEME },
    bdi: 25,
    assets: [],
    expenses: [],
    planning: {
      tasks: [],
      forecasts: [],
      milestones: []
    },
    journal: {
      entries: []
    },
    config: { 
      strict: false, 
      printCards: true, 
      printSubtotals: true 
    }
  }),

  createGroup: (name: string, parentId: string | null = null, order: number = 0): ProjectGroup => ({
    id: crypto.randomUUID(),
    parentId,
    name: name.trim() || 'Nova Pasta',
    order,
    children: []
  }),

  /**
   * closeMeasurement
   * Realiza a "virada" de mês/período.
   */
  closeMeasurement: (project: Project): Project => {
    try {
      const stats = treeService.calculateBasicStats(project.items, project.bdi);
      const snapshot: MeasurementSnapshot = {
        measurementNumber: project.measurementNumber,
        date: new Date().toLocaleDateString('pt-BR'),
        items: JSON.parse(JSON.stringify(project.items)),
        totals: {
          contract: stats.contract,
          period: stats.current,
          accumulated: stats.accumulated,
          progress: stats.progress
        }
      };

      const rotatedItems = project.items.map(item => {
        if (item.type === 'category') {
          return { ...item, currentTotal: 0, currentPercentage: 0 };
        }
        const newPreviousQuantity = (item.previousQuantity || 0) + (item.currentQuantity || 0);
        const newPreviousTotal = (item.previousTotal || 0) + (item.currentTotal || 0);

        return {
          ...item,
          previousQuantity: newPreviousQuantity,
          previousTotal: newPreviousTotal,
          currentQuantity: 0,
          currentTotal: 0,
          currentPercentage: 0
        };
      });

      return {
        ...project,
        measurementNumber: project.measurementNumber + 1,
        items: rotatedItems,
        history: [snapshot, ...(project.history || [])],
        referenceDate: new Date().toLocaleDateString('pt-BR')
      };
    } catch (error) {
      console.error("Erro crítico ao rotacionar medição:", error);
      throw error;
    }
  },

  /**
   * reopenLatestMeasurement
   * Permite reabrir a última medição para correções.
   * Recupera o snapshot mais recente e o torna o estado atual.
   */
  reopenLatestMeasurement: (project: Project): Project => {
    if (!project.history || project.history.length === 0) return project;

    // Remove o snapshot mais recente do histórico
    const [latestSnapshot, ...remainingHistory] = project.history;

    return {
      ...project,
      measurementNumber: latestSnapshot.measurementNumber,
      referenceDate: latestSnapshot.date,
      // Restaura os itens com os valores medidos que estavam salvos no snapshot
      items: JSON.parse(JSON.stringify(latestSnapshot.items)),
      history: remainingHistory
    };
  },

  /**
   * Reatribui itens de um grupo que está sendo excluído
   */
  getReassignedItems: (groupId: string, groups: ProjectGroup[], projects: Project[]) => {
    const targetGroup = groups.find(g => g.id === groupId);
    const newParentId = targetGroup?.parentId || null;

    const updatedGroups = groups
      .filter(g => g.id !== groupId)
      .map(g => g.parentId === groupId ? { ...g, parentId: newParentId } : g);

    const updatedProjects = projects.map(p => 
      p.groupId === groupId ? { ...p, groupId: newParentId } : p
    );

    return { updatedGroups, updatedProjects, newParentId };
  },

  /**
   * Move uma obra ou pasta para um novo grupo destino
   */
  moveItem: (
    itemId: string, 
    itemType: 'project' | 'group', 
    targetGroupId: string | null,
    projects: Project[],
    groups: ProjectGroup[]
  ) => {
    if (itemType === 'project') {
      const updatedProjects = projects.map(p => 
        p.id === itemId ? { ...p, groupId: targetGroupId } : p
      );
      return { updatedProjects, updatedGroups: groups };
    } else {
      // Evitar mover pasta para dentro de si mesma
      if (itemId === targetGroupId) return { updatedProjects: projects, updatedGroups: groups };
      
      const updatedGroups = groups.map(g => 
        g.id === itemId ? { ...g, parentId: targetGroupId } : g
      );
      return { updatedProjects: projects, updatedGroups: updatedGroups };
    }
  }
};