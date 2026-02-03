
import { ProjectPlanning, PlanningTask, MaterialForecast, Milestone, WorkItem, ProjectExpense } from '../types';

/**
 * PlanningService
 * 
 * Gerencia a inteligência de negócios do planejamento de obra.
 * Focado em transformar dados passivos da EAP em ações proativas de cronograma.
 */
export const planningService = {

  // ==========================================
  // AUTO-GERAÇÃO E INTELIGÊNCIA EAP
  // ==========================================

  /**
   * generateTasksFromWbs
   * 
   * Analisa a planilha de medição e identifica itens que foram contratados
   * mas ainda possuem 0% de execução. Sugere esses itens como tarefas.
   */
  generateTasksFromWbs: (planning: ProjectPlanning, workItems: WorkItem[]): ProjectPlanning => {
    // Filtramos apenas folhas (itens) que tenham contrato mas zero execução acumulada
    const unstartedItems = workItems.filter(item => 
      item.type === 'item' && 
      (item.contractQuantity || 0) > 0 && 
      (item.accumulatedQuantity || 0) === 0
    );

    // Evitamos duplicidade: não criamos tarefas para itens que já possuem vínculo na lista atual
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
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Prazo padrão: +7 dias
        createdAt: new Date().toISOString()
      }));

    return {
      ...planning,
      tasks: [...(planning.tasks || []), ...newTasks]
    };
  },

  /**
   * getUrgencyLevel
   * 
   * Implementa a regra de negócio de destaque para prazos críticos.
   * Retorna 'urgent' se o prazo for inferior a 3 dias da data atual.
   */
  getUrgencyLevel: (dateStr: string): 'urgent' | 'warning' | 'normal' => {
    if (!dateStr) return 'normal';
    
    const dueDate = new Date(dateStr);
    const today = new Date();
    
    // Resetamos horas para comparação puramente por data
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'urgent'; // Vencido
    if (diffDays <= 3) return 'urgent'; // Janela de urgência crítica
    if (diffDays <= 7) return 'warning'; // Atenção preventiva
    return 'normal';
  },

  // ==========================================
  // SINCRONIZAÇÃO PLANEJADO -> GASTO REAL
  // ==========================================

  /**
   * prepareExpenseFromForecast
   * 
   * Prepara um objeto ProjectExpense a partir de uma previsão de material.
   * SINCRONIZAÇÃO: Esta função é o "gancho" que permite ao usuário transformar
   * o que era uma intenção de compra em um registro de saída financeira real.
   */
  prepareExpenseFromForecast: (forecast: MaterialForecast): Partial<ProjectExpense> => {
    return {
      id: crypto.randomUUID(),
      type: 'material',
      itemType: 'item',
      date: new Date().toISOString().split('T')[0],
      description: `Compra Efetivada: ${forecast.description}`,
      unit: forecast.unit,
      quantity: forecast.quantityNeeded,
      isPaid: false,
      amount: 0 // Valor deve ser ajustado pelo usuário no ato da nota fiscal
    };
  },

  // ==========================================
  // GESTÃO DE ESTADO (CRUD IMUTÁVEL)
  // ==========================================

  addTask: (planning: ProjectPlanning, description: string, categoryId: string | null = null): ProjectPlanning => {
    const now = new Date().toISOString();
    return {
      ...planning,
      tasks: [...(planning.tasks || []), {
        id: crypto.randomUUID(),
        categoryId,
        description: description.trim() || 'Nova Tarefa de Planejamento',
        isCompleted: false,
        dueDate: now,
        createdAt: now
      }]
    };
  },

  updateTask: (planning: ProjectPlanning, taskId: string, updates: Partial<PlanningTask>): ProjectPlanning => {
    const updatedTasks = planning.tasks.map(task => {
      if (task.id !== taskId) return task;
      
      const merged = { ...task, ...updates };

      // Lógica de Timestamp de Conclusão
      if (updates.isCompleted === true && !merged.completedAt) {
        merged.completedAt = new Date().toISOString();
      } else if (updates.isCompleted === false) {
        merged.completedAt = undefined;
      }

      // Validação Crítica: Conclusão não pode ser anterior à criação
      if (merged.completedAt && new Date(merged.completedAt) < new Date(task.createdAt)) {
        merged.completedAt = task.createdAt;
      }

      return merged;
    });

    return { ...planning, tasks: updatedTasks };
  },

  deleteTask: (planning: ProjectPlanning, taskId: string): ProjectPlanning => ({
    ...planning,
    tasks: planning.tasks.filter(t => t.id !== taskId)
  }),

  // --- SUPRIMENTOS (FORECASTS) ---

  addForecast: (planning: ProjectPlanning, data: Partial<MaterialForecast>): ProjectPlanning => ({
    ...planning,
    forecasts: [...(planning.forecasts || []), {
      id: crypto.randomUUID(),
      description: data.description || 'Insumo Previsto',
      quantityNeeded: data.quantityNeeded || 0,
      unit: data.unit || 'un',
      estimatedDate: data.estimatedDate || new Date().toISOString(),
      status: data.status || 'pending'
    }]
  }),

  updateForecast: (planning: ProjectPlanning, id: string, updates: Partial<MaterialForecast>): ProjectPlanning => ({
    ...planning,
    forecasts: (planning.forecasts || []).map(f => f.id === id ? { ...f, ...updates } : f)
  }),

  deleteForecast: (planning: ProjectPlanning, id: string): ProjectPlanning => ({
    ...planning,
    forecasts: (planning.forecasts || []).filter(f => f.id !== id)
  }),

  // --- METAS (MILESTONES) ---

  addMilestone: (planning: ProjectPlanning, title: string, date: string): ProjectPlanning => ({
    ...planning,
    milestones: [...(planning.milestones || []), {
      id: crypto.randomUUID(),
      title: title || 'Nova Meta do Projeto',
      date: date || new Date().toISOString(),
      isCompleted: false
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

  // ==========================================
  // MANUTENÇÃO DE INTEGRIDADE
  // ==========================================

  /**
   * cleanupOrphanedTasks
   * 
   * Sempre que a árvore principal (EAP) é alterada, esta função deve ser
   * executada para garantir que tarefas não apontem para IDs excluídos.
   */
  cleanupOrphanedTasks: (planning: ProjectPlanning, currentItems: WorkItem[]): ProjectPlanning => {
    const validIds = new Set(currentItems.map(i => i.id));
    
    const sanitizedTasks = (planning.tasks || []).map(task => {
      // Se a tarefa tem um vínculo EAP mas o ID não existe mais, desvincula (órfão)
      if (task.categoryId && !validIds.has(task.categoryId)) {
        return { ...task, categoryId: null };
      }
      return task;
    });

    return {
      ...planning,
      tasks: sanitizedTasks
    };
  }
};
