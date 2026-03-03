
import { Project, ProjectGroup, DEFAULT_THEME, MeasurementSnapshot } from '../types';
import { treeService } from './treeService';
import { financial } from '../utils/math';

export const projectService = {
  createProject: (name: string, companyName: string, groupId: string | null = null): Project => ({
    id: crypto.randomUUID(),
    groupId,
    order: 0,
    name: name.trim() || 'Novo Empreendimento',
    companyName: companyName.trim() || 'Empresa Padrão',
    companyCnpj: '',
    location: '',
    measurementNumber: 1,
    referenceDate: new Date().toLocaleDateString('pt-BR'),
    logo: null,
    items: [],
    blueprintItems: [],
    history: [],
    theme: { ...DEFAULT_THEME },
    bdi: 25,
    assets: [],
    expenses: [],
    // Fix: Adding missing 'workforce' property to satisfy 'Project' interface
    workforce: [],
    // Fix: Adding missing 'laborContracts' property to satisfy 'Project' interface
    laborContracts: [],
    planning: {
      tasks: [],
      forecasts: [],
      milestones: []
    },
    journal: {
      entries: []
    },
    stockItems: [],
    config: {
      strict: false,
      printCards: true,
      printSubtotals: true,
      showSignatures: true
    }
  }),

  createGroup: (name: string, parentId: string | null = null, order: number = 0): ProjectGroup => ({
    id: crypto.randomUUID(),
    parentId,
    name: name.trim() || 'Nova Pasta',
    order,
    children: []
  }),

  closeMeasurement: (project: Project): Project => {
    try {
      const wbsItems = project.items;
      const blueprintItems = project.blueprintItems || [];
      const stats = treeService.calculateBasicStats(wbsItems, project.bdi);
      const snapshot: MeasurementSnapshot = {
        measurementNumber: project.measurementNumber,
        date: new Date().toLocaleDateString('pt-BR'),
        items: JSON.parse(JSON.stringify(wbsItems)),
        blueprintItems: JSON.parse(JSON.stringify(blueprintItems)),
        totals: {
          contract: stats.contract,
          period: stats.current,
          accumulated: stats.accumulated,
          progress: stats.progress
        }
      };

      const rotatedWbsById = new Map(
        wbsItems.map(item => {
          if (item.type === 'category') {
            return [item.id, { ...item, currentTotal: 0, currentPercentage: 0 }] as const;
          }

          const newPreviousQuantity = financial.round((item.previousQuantity || 0) + (item.currentQuantity || 0));
          const newPreviousTotal = financial.truncate((item.previousTotal || 0) + (item.currentTotal || 0));

          return [
            item.id,
            {
              ...item,
              previousQuantity: newPreviousQuantity,
              previousTotal: newPreviousTotal,
              currentQuantity: 0,
              currentTotal: 0,
              currentPercentage: 0
            }
          ] as const;
        })
      );

      const rotatedItems = project.items.map(item => rotatedWbsById.get(item.id) ?? item);

      return {
        ...project,
        measurementNumber: project.measurementNumber + 1,
        items: rotatedItems,
        blueprintItems,
        history: [snapshot, ...(project.history || [])],
        referenceDate: new Date().toLocaleDateString('pt-BR')
      };
    } catch (error) {
      console.error("Erro crítico ao rotacionar medição:", error);
      throw error;
    }
  },

  reopenLatestMeasurement: (project: Project): Project => {
    if (!project.history || project.history.length === 0) return project;
    const [latestSnapshot, ...remainingHistory] = project.history;

    const snapshotWbsItems = JSON.parse(JSON.stringify(latestSnapshot.items)) as Project['items'];
    const snapshotBlueprintItems = JSON.parse(JSON.stringify(latestSnapshot.blueprintItems || project.blueprintItems || [])) as Project['blueprintItems'];

    return {
      ...project,
      measurementNumber: latestSnapshot.measurementNumber,
      referenceDate: latestSnapshot.date,
      items: snapshotWbsItems,
      blueprintItems: snapshotBlueprintItems,
      history: remainingHistory
    };
  },

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
      if (itemId === targetGroupId) return { updatedProjects: projects, updatedGroups: groups };
      const updatedGroups = groups.map(g =>
        g.id === itemId ? { ...g, parentId: targetGroupId } : g
      );
      return { updatedProjects: projects, updatedGroups: updatedGroups };
    }
  }
};
