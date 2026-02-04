
import { ProjectPlanning, PlanningTask, MaterialForecast, Milestone, WorkItem, ProjectExpense, TaskStatus } from '../types';

export const planningService = {

  generateTasksFromWbs: (planning: ProjectPlanning, workItems: WorkItem[]): ProjectPlanning => {
    const unstartedItems = workItems.filter(item => 
      item.type === 'item' && 
      (item.contractQuantity || 0) > 0 && 
      (item.accumulatedQuantity || 0) === 0
    );

    const existingCategoryLinks = new Set(
      (planning.tasks || []).map(t => t.categoryId).filter(id => id !== null)
    );

    const newTasks: PlanningTask[] = unstartedItems
      .filter(item => !existingCategoryLinks.has(item.id))
      .map(item => ({
        id: crypto.randomUUID(),
        categoryId: item.id,
        description: `Iniciar execução: ${item.name}`,
        isCompleted: false,
        status: 'todo',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }));

    return {
      ...planning,
      tasks: [...(planning.tasks || []), ...newTasks]
    };
  },

  getUrgencyLevel: (dateStr: string): 'urgent' | 'warning' | 'normal' => {
    if (!dateStr) return 'normal';
    
    const dueDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'urgent';
    if (diffDays <= 3) return 'urgent';
    if (diffDays <= 7) return 'warning';
    return 'normal';
  },

  prepareExpenseFromForecast: (forecast: MaterialForecast, parentId: string | null = null): Partial<ProjectExpense> => {
    const totalAmount = (forecast.quantityNeeded || 0) * (forecast.unitPrice || 0);
    return {
      id: crypto.randomUUID(),
      parentId: parentId,
      type: 'material',
      itemType: 'item',
      date: new Date().toISOString().split('T')[0],
      description: `Compra Efetivada: ${forecast.description}`,
      unit: forecast.unit,
      quantity: forecast.quantityNeeded,
      unitPrice: forecast.unitPrice,
      isPaid: forecast.isPaid || true, // Sincroniza com o estado do forecast
      amount: totalAmount
    };
  },

  addTask: (planning: ProjectPlanning, data: Partial<PlanningTask>): ProjectPlanning => {
    const now = new Date().toISOString();
    return {
      ...planning,
      tasks: [...(planning.tasks || []), {
        id: crypto.randomUUID(),
        categoryId: data.categoryId || null,
        description: data.description?.trim() || 'Nova Tarefa',
        isCompleted: data.status === 'done',
        status: data.status || 'todo',
        dueDate: data.dueDate || now,
        createdAt: now
      }]
    };
  },

  updateTask: (planning: ProjectPlanning, taskId: string, updates: Partial<PlanningTask>): ProjectPlanning => {
    const updatedTasks = planning.tasks.map(task => {
      if (task.id !== taskId) return task;
      
      const merged = { ...task, ...updates };

      if (updates.status) {
        merged.isCompleted = updates.status === 'done';
      }

      if (merged.isCompleted && !merged.completedAt) {
        merged.completedAt = new Date().toISOString();
      } else if (!merged.isCompleted) {
        merged.completedAt = undefined;
      }

      return merged;
    });

    return { ...planning, tasks: updatedTasks };
  },

  deleteTask: (planning: ProjectPlanning, taskId: string): ProjectPlanning => ({
    ...planning,
    tasks: (planning.tasks || []).filter(t => t.id !== taskId)
  }),

  addForecast: (planning: ProjectPlanning, data: Partial<MaterialForecast>): ProjectPlanning => ({
    ...planning,
    forecasts: [...(planning.forecasts || []), {
      id: crypto.randomUUID(),
      description: data.description || 'Insumo Previsto',
      quantityNeeded: data.quantityNeeded || 0,
      unitPrice: data.unitPrice || 0,
      unit: data.unit || 'un',
      estimatedDate: data.estimatedDate || new Date().toISOString(),
      status: data.status || 'pending',
      isPaid: data.isPaid || false,
      order: planning.forecasts.length
    }]
  }),

  updateForecast: (planning: ProjectPlanning, id: string, updates: Partial<MaterialForecast>): ProjectPlanning => ({
    ...planning,
    forecasts: (planning.forecasts || []).map(f => f.id === id ? { ...f, ...updates } : f)
  }),

  reorderForecasts: (planning: ProjectPlanning, id: string, direction: 'up' | 'down'): ProjectPlanning => {
    const list = [...planning.forecasts].sort((a, b) => a.order - b.order);
    const idx = list.findIndex(f => f.id === id);
    if (idx === -1) return planning;
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return planning;
    
    const [movedItem] = list.splice(idx, 1);
    list.splice(newIdx, 0, movedItem);
    
    const updatedList = list.map((item, i) => ({ ...item, order: i }));
    
    return { ...planning, forecasts: updatedList };
  },

  moveForecast: (planning: ProjectPlanning, sourceIndex: number, destinationIndex: number): ProjectPlanning => {
    const list = [...planning.forecasts].sort((a, b) => a.order - b.order);
    const [movedItem] = list.splice(sourceIndex, 1);
    list.splice(destinationIndex, 0, movedItem);

    const updatedList = list.map((item, i) => ({ ...item, order: i }));
    return { ...planning, forecasts: updatedList };
  },

  deleteForecast: (planning: ProjectPlanning, id: string): ProjectPlanning => ({
    ...planning,
    forecasts: (planning.forecasts || []).filter(f => f.id !== id)
  }),

  addMilestone: (planning: ProjectPlanning, data: Partial<Milestone>): ProjectPlanning => ({
    ...planning,
    milestones: [...(planning.milestones || []), {
      id: crypto.randomUUID(),
      title: data.title || 'Nova Meta do Projeto',
      date: data.date || new Date().toISOString(),
      isCompleted: !!data.isCompleted
    }]
  }),

  updateMilestone: (planning: ProjectPlanning, id: string, updates: Partial<Milestone>): ProjectPlanning => ({
    ...planning,
    milestones: (planning.milestones || []).map(m => m.id === id ? { ...m, ...updates } : m)
  }),

  deleteMilestone: (planning: ProjectPlanning, id: string): ProjectPlanning => ({
    ...planning,
    milestones: (planning.milestones || []).filter(m => m.id !== id)
  }),

  cleanupOrphanedTasks: (planning: ProjectPlanning, currentItems: WorkItem[]): ProjectPlanning => {
    const validIds = new Set(currentItems.map(i => i.id));
    const sanitizedTasks = (planning.tasks || []).map(task => {
      if (task.categoryId && !validIds.has(task.categoryId)) {
        return { ...task, categoryId: null };
      }
      return task;
    });
    return { ...planning, tasks: sanitizedTasks };
  }
};
