
import { JournalEntry, JournalCategory, WeatherType, ProjectJournal, WorkItem, ProjectExpense } from '../types';

export const journalService = {
  createEntry: (
    title: string, 
    description: string, 
    category: JournalCategory = 'PROGRESS',
    type: 'AUTO' | 'MANUAL' = 'MANUAL',
    weather?: WeatherType,
    progressStage?: string,
    progressItem?: string
  ): JournalEntry => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    category,
    title,
    description,
    progressStage,
    progressItem,
    weatherStatus: weather,
    photoUrls: []
  }),

  /**
   * Monitora a conclusão física de itens da EAP.
   */
  checkWorkItemDeltas: (oldItems: WorkItem[], newItems: WorkItem[]): JournalEntry[] => {
    const logs: JournalEntry[] = [];
    const oldMap = new Map(oldItems.map(i => [i.id, i.accumulatedPercentage]));

    newItems.forEach(item => {
      const oldPerc = oldMap.get(item.id) || 0;
      const newPerc = item.accumulatedPercentage || 0;
      if (oldPerc < 100 && newPerc >= 100 && item.type === 'item') {
        logs.push(journalService.createEntry(
          `Marco de Execução: ${item.wbs}`,
          `O serviço "${item.name}" foi concluído fisicamente (100% acumulado).`,
          'PROGRESS',
          'AUTO'
        ));
      }
    });
    return logs;
  },

  /**
   * Monitora transições de status no fluxo de suprimentos.
   */
  checkExpenseStatusDeltas: (oldExpenses: ProjectExpense[], newExpenses: ProjectExpense[]): JournalEntry[] => {
    const logs: JournalEntry[] = [];
    const oldMap = new Map(oldExpenses.map(e => [e.id, e.status]));

    newExpenses.forEach(exp => {
      const oldStatus = oldMap.get(exp.id);
      const newStatus = exp.status;

      if (oldStatus !== newStatus) {
        if (newStatus === 'DELIVERED') {
          logs.push(journalService.createEntry(
            'Recebimento de Material',
            `Entrega confirmada no canteiro: ${exp.description}. Documento fiscal vinculado ao sistema.`,
            'PROGRESS',
            'AUTO'
          ));
        }
      }
    });
    return logs;
  },

  addEntry: (journal: ProjectJournal, entry: Partial<JournalEntry>): ProjectJournal => {
    const fullEntry: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: entry.type || 'MANUAL',
      category: entry.category || 'PROGRESS',
      title: entry.title || 'Novo Registro',
      description: entry.description || '',
      progressStage: entry.progressStage,
      progressItem: entry.progressItem,
      weatherStatus: entry.weatherStatus,
      photoUrls: entry.photoUrls || []
    };
    return { ...journal, entries: [fullEntry, ...journal.entries] };
  },

  deleteEntry: (journal: ProjectJournal, id: string): ProjectJournal => ({
    ...journal,
    entries: journal.entries.filter(e => e.id !== id)
  }),

  getPaginatedEntries: (entries: JournalEntry[], page: number, pageSize: number): JournalEntry[] => {
    const start = (page - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }
};
