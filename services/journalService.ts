
import { JournalEntry, JournalCategory, WeatherType, ProjectJournal, WorkItem, ProjectExpense } from '../types';
import { financial } from '../utils/math';

/**
 * JournalService - Engine de Interceptação
 * 
 * Atua como um middleware de observação para o estado do projeto.
 * Monitora alterações críticas e gera logs automáticos (Audit Trail).
 */
export const journalService = {
  
  /**
   * createEntry
   * Factory para criação de entradas padronizadas.
   */
  createEntry: (
    title: string, 
    description: string, 
    category: JournalCategory = 'PROGRESS',
    type: 'AUTO' | 'MANUAL' = 'MANUAL',
    weather?: WeatherType
  ): JournalEntry => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    category,
    title,
    description,
    weatherStatus: weather,
    photoUrls: []
  }),

  /**
   * checkWorkItemDeltas
   * Compara o estado anterior e atual dos itens para detectar conclusões (100%).
   * TRIGGER: Chamado sempre que a planilha de medição é alterada.
   */
  checkWorkItemDeltas: (oldItems: WorkItem[], newItems: WorkItem[]): JournalEntry[] => {
    const logs: JournalEntry[] = [];
    const oldMap = new Map(oldItems.map(i => [i.id, i.accumulatedPercentage]));

    newItems.forEach(item => {
      const oldPerc = oldMap.get(item.id) || 0;
      const newPerc = item.accumulatedPercentage || 0;

      // Se o item acabou de atingir 100%
      if (oldPerc < 100 && newPerc >= 100 && item.type === 'item') {
        logs.push(journalService.createEntry(
          `Etapa Concluída: ${item.wbs}`,
          `O serviço "${item.name}" atingiu 100% de execução física acumulada.`,
          'PROGRESS',
          'AUTO'
        ));
      }
    });

    return logs;
  },

  /**
   * checkFinancialAlerts
   * Intercepta gastos que superam o limite de sensibilidade do projeto.
   * TRIGGER: Chamado no registro de novas despesas.
   */
  checkFinancialAlerts: (expense: ProjectExpense, threshold: number): JournalEntry | null => {
    if (expense.itemType === 'item' && expense.type !== 'revenue' && expense.amount > threshold) {
      return journalService.createEntry(
        `Alerta de Gasto Elevado`,
        `Registro de despesa de alto valor: ${financial.formatBRL(expense.amount)} referente a "${expense.description}" (${expense.entityName}).`,
        'FINANCIAL',
        'AUTO'
      );
    }
    return null;
  },

  /**
   * triggerAutoLog
   * Adiciona um log automático na timeline garantindo ordenação cronológica inversa.
   */
  triggerAutoLog: (journal: ProjectJournal, title: string, description: string, category: JournalCategory): ProjectJournal => {
    const entry = journalService.createEntry(title, description, category, 'AUTO');
    return {
      ...journal,
      entries: [entry, ...journal.entries]
    };
  },

  /**
   * addEntries
   * Adição em lote de entradas (útil para logs gerados por deltas).
   */
  addEntries: (journal: ProjectJournal, newEntries: JournalEntry[]): ProjectJournal => {
    if (newEntries.length === 0) return journal;
    return {
      ...journal,
      entries: [...newEntries, ...journal.entries]
    };
  },

  /**
   * addEntry
   * Adição manual via UI.
   */
  addEntry: (journal: ProjectJournal, entry: Partial<JournalEntry>): ProjectJournal => {
    const fullEntry: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'MANUAL',
      category: entry.category || 'PROGRESS',
      title: entry.title || 'Nova Anotação',
      description: entry.description || '',
      weatherStatus: entry.weatherStatus,
      photoUrls: entry.photoUrls || [],
      linkedItemId: entry.linkedItemId
    };

    return {
      ...journal,
      entries: [fullEntry, ...journal.entries]
    };
  },

  updateEntry: (journal: ProjectJournal, id: string, data: Partial<JournalEntry>): ProjectJournal => ({
    ...journal,
    entries: journal.entries.map(e => e.id === id ? { ...e, ...data } : e)
  }),

  deleteEntry: (journal: ProjectJournal, id: string): ProjectJournal => ({
    ...journal,
    entries: journal.entries.filter(e => e.id !== id)
  }),

  getPaginatedEntries: (entries: JournalEntry[], page: number, pageSize: number = 10) => {
    const start = (page - 1) * pageSize;
    return entries.slice(start, start + pageSize);
  }
};
