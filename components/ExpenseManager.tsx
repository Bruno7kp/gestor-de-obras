
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ProjectExpense, ExpenseType, WorkItem, ItemType, Project, Supplier } from '../types';
import { financial } from '../utils/math';
import { expenseService } from '../services/expenseService';
import { treeService } from '../services/treeService';
import { excelService, ExpenseImportResult } from '../services/excelService';
import { projectExpensesApi } from '../services/projectExpensesApi';
import { ExpenseTreeTable } from './ExpenseTreeTable';
import { ExpenseModal } from './ExpenseModal';
import { ConfirmModal } from './ConfirmModal';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import {
  Plus, Search, CheckCircle2, Wallet, ArrowRightLeft,
  X, BarChart3, PieChart, Clock, ArrowUpRight,
  Maximize2, Minimize2, Truck, Users, Download, UploadCloud,
  FileSpreadsheet, Landmark, Coins, AlertCircle, Printer, FolderPlus, Layers, Info
} from 'lucide-react';

interface ExpenseManagerProps {
  project: Project;
  suppliers: Supplier[];
  expenses: ProjectExpense[];
  onAdd: (expense: ProjectExpense) => void;
  onAddMany: (expenses: ProjectExpense[]) => void;
  onUpdate: (id: string, data: Partial<ProjectExpense>) => void;
  onDelete: (id: string) => void;
  workItems: WorkItem[];
  measuredValue: number;
  onUpdateExpenses: (expenses: ProjectExpense[]) => void;
  isReadOnly?: boolean;
  onRequestPrintReport?: () => void;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  project, suppliers, expenses, onAdd, onAddMany, onUpdate, onDelete, workItems, measuredValue, onUpdateExpenses, isReadOnly, onRequestPrintReport
}) => {
  const { canEdit, getLevel } = usePermissions();
  const toast = useToast();
  const canEditFinancial = canEdit('financial_flow') && !isReadOnly;
  const isSupplyLinkedExpense = (expense: ProjectExpense) =>
    expense.type === 'material' &&
    expense.itemType === 'item' &&
    /^Pedido (Pendente|Pago|Entregue): /.test(expense.description);

  const expenseTabs: Array<ExpenseType | 'overview'> = ['overview', 'revenue', 'material', 'labor', 'other'];
  const expenseTabKey = `exp_fin_tab_${project.id}`;
  const [activeTab, setActiveTab] = useState<ExpenseType | 'overview'>(() => {
    const saved = uiPreferences.getString(expenseTabKey);
    return saved && expenseTabs.includes(saved as ExpenseType | 'overview')
      ? (saved as ExpenseType | 'overview')
      : 'overview';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`exp_fin_${project.id}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });

  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ExpenseImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItemType, setModalItemType] = useState<ItemType>('item');
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(`exp_fin_${project.id}`, JSON.stringify(Array.from(expandedIds)));
  }, [expandedIds, project.id]);

  useEffect(() => {
    const saved = uiPreferences.getString(expenseTabKey);
    if (saved && expenseTabs.includes(saved as ExpenseType | 'overview')) {
      setActiveTab(saved as ExpenseType | 'overview');
    } else {
      setActiveTab('overview');
    }
  }, [project.id, expenseTabKey]);

  useEffect(() => {
    uiPreferences.setString(expenseTabKey, activeTab);
  }, [activeTab, expenseTabKey]);

  const isWithinRange = useCallback((date?: string) => {
    if (!dateStart && !dateEnd) return true;
    if (!date) return false;
    if (dateStart && date < dateStart) return false;
    if (dateEnd && date > dateEnd) return false;
    return true;
  }, [dateStart, dateEnd]);

  const filteredItemsByDate = useMemo(() => (
    expenses.filter(expense => expense.itemType === 'item' && isWithinRange(expense.date))
  ), [expenses, isWithinRange]);

  const stats = useMemo(() => expenseService.getExpenseStats(filteredItemsByDate), [filteredItemsByDate]);

  const projectedBalance = financial.round(stats.revenue - stats.totalOut);

  // Filtramos apenas as categorias do tipo ativo (MO, MAT ou RE) para o dropdown do modal
  const processedExpenseCategories = useMemo(() => {
    const filterTab = activeTab === 'overview' ? 'material' : activeTab;
    const filtered = expenses.filter(e => e.type === filterTab);
    const tree = treeService.buildTree(filtered);
    const processed = tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
    const allIds = new Set<string>(filtered.map(e => e.id));
    const flattened = treeService.flattenTree(processed, allIds);
    return flattened.filter(e => e.itemType === 'category');
  }, [expenses, activeTab]);

  const currentExpenses = useMemo(() => {
    if (activeTab === 'overview') return [];
    const scoped = expenses.filter(e => e.type === activeTab);
    const filtered = (() => {
      if (!dateStart && !dateEnd) return scoped;
      const byId = new Map(scoped.map(expense => [expense.id, expense] as const));
      const allowedIds = new Set<string>();

      scoped.forEach(expense => {
        if (expense.itemType !== 'item') return;
        if (!isWithinRange(expense.date)) return;
        let current: ProjectExpense | undefined = expense;
        while (current) {
          if (allowedIds.has(current.id)) break;
          allowedIds.add(current.id);
          if (!current.parentId) break;
          current = byId.get(current.parentId);
        }
      });

      return scoped.filter(expense => allowedIds.has(expense.id));
    })();

    const tree = treeService.buildTree(filtered);
    return tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
  }, [expenses, activeTab, dateStart, dateEnd, isWithinRange]);

  const flattenedExpenses = useMemo(() =>
    treeService.flattenTree(currentExpenses, expandedIds)
    , [currentExpenses, expandedIds]);

  const reorderExpensesInActiveTab = (
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside',
  ) => {
    if (activeTab === 'overview') return;
    const scoped = expenses.filter(expense => expense.type === activeTab);
    const source = scoped.find(expense => expense.id === sourceId);
    const target = scoped.find(expense => expense.id === targetId);
    if (!source || !target || sourceId === targetId) return;

    const oldParentId = source.parentId ?? null;
    const newParentId = position === 'inside' ? target.id : target.parentId ?? null;

    const targetSiblings = scoped
      .filter(expense => expense.parentId === newParentId && expense.id !== sourceId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const targetIndex = targetSiblings.findIndex(expense => expense.id === targetId);
    if (targetIndex === -1) return;

    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
    const nextSiblings = [...targetSiblings];
    nextSiblings.splice(insertIndex, 0, { ...source, parentId: newParentId });

    const updates = new Map<string, Partial<ProjectExpense>>();
    nextSiblings.forEach((expense, index) => {
      updates.set(expense.id, { parentId: newParentId, order: index });
    });

    if (oldParentId !== newParentId) {
      const oldSiblings = scoped
        .filter(expense => expense.parentId === oldParentId && expense.id !== sourceId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      oldSiblings.forEach((expense, index) => {
        updates.set(expense.id, { order: index });
      });
    }

    const merged = expenses.map(item => {
      if (item.type !== activeTab) return item;
      const patch = updates.get(item.id);
      return patch ? { ...item, ...patch } : item;
    });

    onUpdateExpenses(merged);
  };

  const moveExpenseInActiveTab = (id: string, direction: 'up' | 'down') => {
    if (activeTab === 'overview') return;
    const scoped = expenses.filter(expense => expense.type === activeTab);
    const item = scoped.find(expense => expense.id === id);
    if (!item) return;

    const siblings = scoped
      .filter(expense => expense.parentId === (item.parentId ?? null))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const currentIndex = siblings.findIndex(expense => expense.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = new Map<string, Partial<ProjectExpense>>();
    reordered.forEach((expense, index) => {
      updates.set(expense.id, { order: index });
    });

    const merged = expenses.map(item => {
      if (item.type !== activeTab) return item;
      const patch = updates.get(item.id);
      return patch ? { ...item, ...patch } : item;
    });

    onUpdateExpenses(merged);
  };

  const moveExpenseToTop = (
    items: ProjectExpense[],
    expenseId: string,
    nextParentId: string | null,
    nextType: ExpenseType,
  ) => {
    return items.map(item => {
      if (item.id === expenseId) {
        return { ...item, parentId: nextParentId, type: nextType, order: 0 };
      }
      if (item.type === nextType && item.parentId === nextParentId) {
        return { ...item, order: (item.order ?? 0) + 1 };
      }
      return item;
    });
  };

  const requestDeleteExpense = (id: string) => {
    if (!canEditFinancial) return;
    setConfirmDeleteId(id);
  };

  const handleImportExpenses = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const res = await excelService.parseExpensesExcel(file);
      setImportSummary(res);
    } catch (err) {
      toast.error("Erro ao importar despesas: " + (err instanceof Error ? err.message : 'Arquivo inválido'));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [importProgress, setImportProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });

  const confirmImport = async () => {
    if (!importSummary) return;
    const typesInFile = new Set<ExpenseType>();
    if (importSummary.stats.byType.labor > 0) typesInFile.add('labor');
    if (importSummary.stats.byType.material > 0) typesInFile.add('material');
    if (importSummary.stats.byType.revenue > 0) typesInFile.add('revenue');
    if (importSummary.stats.byType.other > 0) typesInFile.add('other');

    // optimistic update
    let updatedExpenses = expenses.filter(e => !typesInFile.has(e.type));
    updatedExpenses = [...updatedExpenses, ...importSummary.expenses];
    onUpdateExpenses(updatedExpenses);

    setExpandedIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      importSummary.expenses.filter(ex => ex.itemType === 'category').forEach(ex => next.add(ex.id));
      return next;
    });

    // send batches to backend
    setIsImporting(true);
    setImportProgress({ sent: 0, total: importSummary.expenses.length });

    const CHUNK_SIZE = 500;
    const sorted = importSummary.expenses; // expenses already ordered by WBS mapping
    const chunks: typeof sorted[] = [];
    for (let i = 0; i < sorted.length; i += CHUNK_SIZE) chunks.push(sorted.slice(i, i + CHUNK_SIZE));

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        // only for first chunk pass replaceTypes to remove existing of those types
        await projectExpensesApi.batch(project.id, chunk, i === 0 ? Array.from(typesInFile) : undefined);
        setImportProgress(prev => ({ sent: prev.sent + chunk.length, total: prev.total }));
      }
      setImportSummary(null);
    } catch (err) {
      console.error('Erro ao importar despesas:', err);
      toast.error('Erro ao importar despesas. Tente novamente.');
      // revert optimistic update by reloading from server could be added
    } finally {
      setIsImporting(false);
      setImportProgress({ sent: 0, total: 0 });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importMaterialGroupsFromWbs = () => {
    if (activeTab !== 'material') return;
    if (!canEditFinancial) return;

    const categories = workItems.filter(item => item.type === 'category');
    if (categories.length === 0) {
      toast.warning('Nenhum grupo encontrado na EAP.');
      return;
    }

    const existingCategories = expenses.filter(expense =>
      expense.type === 'material' &&
      expense.itemType === 'category' &&
      expense.linkedWorkItemId
    );

    const byWorkItemId = new Map<string, ProjectExpense>(
      existingCategories.map(expense => [expense.linkedWorkItemId as string, expense])
    );

    const categoryMap = new Map(categories.map(item => [item.id, item] as const));
    const depthCache = new Map<string, number>();
    const getDepth = (id: string): number => {
      const cached = depthCache.get(id);
      if (cached !== undefined) return cached;
      const current = categoryMap.get(id);
      if (!current?.parentId) {
        depthCache.set(id, 0);
        return 0;
      }
      const parent = categoryMap.get(current.parentId);
      if (!parent || parent.type !== 'category') {
        depthCache.set(id, 0);
        return 0;
      }
      const depth = getDepth(parent.id) + 1;
      depthCache.set(id, depth);
      return depth;
    };

    const sorted = [...categories].sort((a, b) => {
      const depthDiff = getDepth(a.id) - getDepth(b.id);
      if (depthDiff !== 0) return depthDiff;
      return a.order - b.order;
    });

    const today = new Date().toISOString().split('T')[0];
    const newCategories: ProjectExpense[] = [];

    sorted.forEach((item) => {
      if (byWorkItemId.has(item.id)) return;

      const parentExpense = item.parentId ? byWorkItemId.get(item.parentId) : undefined;
      const newCategory: ProjectExpense = {
        id: crypto.randomUUID(),
        parentId: parentExpense?.id ?? null,
        type: 'material',
        itemType: 'category',
        wbs: item.wbs,
        order: item.order,
        date: today,
        description: item.name,
        entityName: '',
        unit: '',
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        isPaid: false,
        status: 'PENDING',
        linkedWorkItemId: item.id,
      };

      newCategories.push(newCategory);
      byWorkItemId.set(item.id, newCategory);
    });

    if (newCategories.length === 0) {
      toast.info('Todos os grupos da EAP ja existem em Materiais.');
      return;
    }

    onAddMany(newCategories);
    setExpandedIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      newCategories.forEach(category => next.add(category.id));
      return next;
    });
    toast.success('Grupos da EAP importados para Materiais.');
  };

  const importLaborGroupsFromWbs = () => {
    if (activeTab !== 'labor') return;
    if (!canEditFinancial) return;

    const categories = workItems.filter(item => item.type === 'category');
    if (categories.length === 0) {
      toast.warning('Nenhum grupo encontrado na EAP.');
      return;
    }

    const existingCategories = expenses.filter(expense =>
      expense.type === 'labor' &&
      expense.itemType === 'category' &&
      expense.linkedWorkItemId
    );

    const byWorkItemId = new Map<string, ProjectExpense>(
      existingCategories.map(expense => [expense.linkedWorkItemId as string, expense])
    );

    const categoryMap = new Map(categories.map(item => [item.id, item] as const));
    const depthCache = new Map<string, number>();
    const getDepth = (id: string): number => {
      const cached = depthCache.get(id);
      if (cached !== undefined) return cached;
      const current = categoryMap.get(id);
      if (!current?.parentId) {
        depthCache.set(id, 0);
        return 0;
      }
      const parent = categoryMap.get(current.parentId);
      if (!parent || parent.type !== 'category') {
        depthCache.set(id, 0);
        return 0;
      }
      const depth = getDepth(parent.id) + 1;
      depthCache.set(id, depth);
      return depth;
    };

    const sorted = [...categories].sort((a, b) => {
      const depthDiff = getDepth(a.id) - getDepth(b.id);
      if (depthDiff !== 0) return depthDiff;
      return a.order - b.order;
    });

    const today = new Date().toISOString().split('T')[0];
    const newCategories: ProjectExpense[] = [];

    sorted.forEach((item) => {
      if (byWorkItemId.has(item.id)) return;

      const parentExpense = item.parentId ? byWorkItemId.get(item.parentId) : undefined;
      const newCategory: ProjectExpense = {
        id: crypto.randomUUID(),
        parentId: parentExpense?.id ?? null,
        type: 'labor',
        itemType: 'category',
        wbs: item.wbs,
        order: item.order,
        date: today,
        description: item.name,
        entityName: '',
        unit: '',
        quantity: 0,
        unitPrice: 0,
        amount: 0,
        isPaid: false,
        status: 'PENDING',
        linkedWorkItemId: item.id,
      };

      newCategories.push(newCategory);
      byWorkItemId.set(item.id, newCategory);
    });

    if (newCategories.length === 0) {
      toast.info('Todos os grupos da EAP ja existem em Mao de Obra.');
      return;
    }

    onAddMany(newCategories);
    setExpandedIds((prev: Set<string>) => {
      const next = new Set<string>(prev);
      newCategories.forEach(category => next.add(category.id));
      return next;
    });
    toast.success('Grupos da EAP importados para Mao de Obra.');
  };

  const handleSaveExpense = (data: Partial<ProjectExpense>) => {
    if (editingExpense) {
      const nextType = (data.type ?? editingExpense.type) as ExpenseType;
      const nextParentId = data.parentId ?? editingExpense.parentId ?? null;
      const updatedExpenses = expenses.map(expense =>
        expense.id === editingExpense.id
          ? { ...expense, ...data, type: nextType, parentId: nextParentId }
          : expense
      );
      if (nextType !== editingExpense.type || nextParentId !== editingExpense.parentId) {
        onUpdateExpenses(moveExpenseToTop(updatedExpenses, editingExpense.id, nextParentId, nextType));
      } else {
        onUpdate(editingExpense.id, data);
      }
    } else {
      const newExpense: ProjectExpense = {
        id: crypto.randomUUID(),
        parentId: data.parentId || null,
        type: data.type || (activeTab === 'overview' ? 'material' : activeTab as ExpenseType),
        itemType: data.itemType || modalItemType,
        wbs: '',
        order: expenses.length,
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || 'Novo Lançamento',
        entityName: data.entityName || '',
        unit: data.unit || 'un',
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice || 0,
        discountValue: data.discountValue || 0,
        discountPercentage: data.discountPercentage || 0,
        issValue: data.issValue || 0,
        issPercentage: data.issPercentage || 0,
        amount: data.amount || 0,
        isPaid: data.isPaid || false,
        status: data.status || 'PENDING',
        paymentProof: data.paymentProof,
        invoiceDoc: data.invoiceDoc,
        deliveryDate: data.deliveryDate
      };
      onAdd(newExpense);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      <input type="file" ref={fileInputRef} className="hidden" hidden accept=".xlsx, .xls" onChange={handleImportExpenses} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CashKpi label="Recebido (Cash In)" value={stats.revenue} icon={<Landmark size={20} />} color="emerald" sub="Total liquidado na conta" />
        <CashKpi label="Pago (Cash Out)" value={stats.paidOut} icon={<Coins size={20} />} color="rose" sub="Comprometido MO + MAT" />
        <CashKpi label="A Pagar" value={stats.unpaidOut} icon={<Clock size={20} />} color="amber" sub="Pagamentos Pendentes" />
        <div className={`p-6 rounded-[2rem] shadow-xl flex flex-col justify-between ${projectedBalance >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="flex justify-between items-start">
            <div className="p-2 bg-white/20 rounded-lg"><Wallet size={20} /></div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Saldo Projetado</span>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tighter leading-none">{financial.formatVisual(projectedBalance, project.theme?.currencySymbol || 'R$')}</p>
            <p className="text-[10px] font-bold uppercase mt-2 opacity-70">Líquido (Receita - Total Gastos)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          <TabTrigger active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Resumo" icon={<BarChart3 size={14} />} />
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center mx-1" />
          <TabTrigger active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} label="Entradas" icon={<ArrowUpRight size={14} />} />
          <TabTrigger active={activeTab === 'material'} onClick={() => setActiveTab('material')} label="Materiais" icon={<Truck size={14} />} />
          <TabTrigger active={activeTab === 'labor'} onClick={() => setActiveTab('labor')} label="Mão de Obra" icon={<Users size={14} />} />
          <TabTrigger active={activeTab === 'other'} onClick={() => setActiveTab('other')} label="Outros" icon={<FileSpreadsheet size={14} />} />
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'overview' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setModalItemType('category'); setEditingExpense(null); setTargetParentId(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all"
              >
                <FolderPlus size={14} /> Grupo
              </button>
              <button
                onClick={() => { setModalItemType('item'); setEditingExpense(null); setTargetParentId(null); setIsModalOpen(true); }}
                className="px-5 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg hover:scale-105 transition-transform"
              >
                Lançamento
              </button>
            </div>
          )}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

          <button
            onClick={() => {
              if (onRequestPrintReport) {
                onRequestPrintReport();
                return;
              }
              window.print();
            }}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Printer size={16} />
          </button>

          <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-emerald-600" title="Importar Excel"><UploadCloud size={18} /></button>
          <button onClick={() => excelService.exportExpensesToExcel(project, expenses, activeTab === 'overview' ? undefined : activeTab as ExpenseType)} className="p-2.5 text-slate-400 hover:text-blue-600" title="Exportar Excel"><Download size={18} /></button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <FinancialSummary stats={stats} currencySymbol={project.theme?.currencySymbol} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setExpandedIds(new Set(expenses.map(e => e.id)))} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-300 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"><Maximize2 size={12} className="inline mr-1" /> Expandir</button>
              <button onClick={() => setExpandedIds(new Set())} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 dark:text-slate-300 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"><Minimize2 size={12} className="inline mr-1" /> Recolher</button>
              {activeTab === 'other' && (
                <div className="relative group">
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-600"
                    aria-label="Informacoes sobre outros"
                  >
                    <Info size={14} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-full z-[200] mt-1 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    Documente transferências para controle interno que não impacte os custos diretos da obra
                  </div>
                </div>
              )}
              {activeTab === 'material' && (
                <button
                  onClick={importMaterialGroupsFromWbs}
                  disabled={!canEditFinancial}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase border rounded-lg transition-colors ${canEditFinancial ? 'text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800' : 'text-slate-300 cursor-not-allowed'}`}
                  title="Importar grupos da EAP"
                >
                  <Layers size={12} className="inline mr-1" /> Importar Grupos
                </button>
              )}
              {activeTab === 'labor' && (
                <button
                  onClick={importLaborGroupsFromWbs}
                  disabled={!canEditFinancial}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase border rounded-lg transition-colors ${canEditFinancial ? 'text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800' : 'text-slate-300 cursor-not-allowed'}`}
                  title="Importar grupos da EAP"
                >
                  <Layers size={12} className="inline mr-1" /> Importar Grupos
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Período</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateStart}
                  onChange={e => setDateStart(e.target.value)}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border rounded-lg text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900"
                  aria-label="Data inicial"
                />
                <span className="text-[10px] font-bold text-slate-400">até</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={e => setDateEnd(e.target.value)}
                  className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest border rounded-lg text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900"
                  aria-label="Data final"
                />
              </div>
            </div>
          </div>

          <ExpenseTreeTable
            data={flattenedExpenses}
            expenseType={activeTab}
            expandedIds={expandedIds}
            onToggle={id => {
              setExpandedIds((prev: Set<string>) => {
                const next = new Set<string>(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onEdit={expense => { setEditingExpense(expense); setIsModalOpen(true); }}
            onDelete={requestDeleteExpense}
            onAddChild={(pid, itype) => { setTargetParentId(pid); setModalItemType(itype); setIsModalOpen(true); }}
            onUpdateTotal={(id, total) => onUpdate(id, { amount: total })}
            onUpdateUnitPrice={(id, price) => onUpdate(id, { unitPrice: price })}
            onTogglePaid={id => {
              const exp = expenses.find(e => e.id === id);
              if (!exp) return;
              if (isSupplyLinkedExpense(exp)) {
                toast.warning('Status controlado por suprimentos.');
                return;
              }
              onUpdate(id, { isPaid: !exp.isPaid, status: !exp.isPaid ? 'PAID' : 'PENDING' });
            }}
            onReorder={reorderExpensesInActiveTab}
            onMoveManual={moveExpenseInActiveTab}
            isReadOnly={isReadOnly}
            currencySymbol={project.theme?.currencySymbol || 'R$'}
          />
        </div>
      )}

      {importSummary && (
        <ExpenseImportReviewModal
          summary={importSummary}
          onClose={() => setImportSummary(null)}
          onConfirm={confirmImport}
          isImporting={isImporting}
          progress={importProgress}
        />
      )}

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        editingItem={editingExpense}
        suppliers={suppliers}
        expenseType={activeTab === 'overview' ? 'material' : (activeTab as ExpenseType)}
        itemType={modalItemType}
        categories={processedExpenseCategories as any}
        currencySymbol={project.theme?.currencySymbol || 'R$'}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir lançamento"
        message={(() => {
          if (!confirmDeleteId) return 'Deseja realmente excluir este lançamento?';
          const target = expenses.find(expense => expense.id === confirmDeleteId);
          const hasChildren = expenses.some(expense => expense.parentId === confirmDeleteId);
          const isCategory = target?.itemType === 'category';
          if (isCategory && hasChildren) {
            return 'Deseja realmente excluir este grupo? Os itens vinculados também serão removidos.';
          }
          return 'Deseja realmente excluir este lançamento?';
        })()}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (!confirmDeleteId) return;
          const deleteId = confirmDeleteId;
          setConfirmDeleteId(null);
          onDelete(deleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

const ExpenseImportReviewModal = ({ summary, onClose, onConfirm, isImporting, progress }: { summary: ExpenseImportResult, onClose: () => void, onConfirm: () => void, isImporting?: boolean, progress?: { sent: number; total: number } }) => (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
    <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl"><UploadCloud size={24} /></div>
          <div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Revisar Importação</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Planilha Financeira Processada</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><X size={20} /></button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
          <p className="text-2xl font-black text-blue-600">{summary.stats.byType.labor}</p>
          <p className="text-[8px] font-black uppercase text-slate-400">Mão de Obra</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
          <p className="text-2xl font-black text-indigo-600">{summary.stats.byType.material}</p>
          <p className="text-[8px] font-black uppercase text-slate-400">Materiais</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
          <p className="text-2xl font-black text-emerald-600">{summary.stats.byType.revenue}</p>
          <p className="text-[8px] font-black uppercase text-slate-400">Receitas</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl text-center border border-slate-100 dark:border-slate-700">
          <p className="text-2xl font-black text-slate-600">{summary.stats.byType.other}</p>
          <p className="text-[8px] font-black uppercase text-slate-400">Outros</p>
        </div>
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex gap-3">
        <AlertCircle size={20} className="text-amber-500 shrink-0" />
        <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-tight">
          Ao confirmar, os registros de Mão de Obra, Materiais, Receitas e Outros do sistema serão **SUBSTITUÍDOS** pelos dados desta planilha para evitar duplicações.
        </p>
      </div>

      {isImporting && progress && (
        <div className="px-2">
          <div className="w-full bg-slate-100 dark:bg-slate-900 h-3 rounded-full overflow-hidden">
            <div className="h-3 bg-emerald-500" style={{ width: `${progress.total > 0 ? (progress.sent / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-[10px] mt-2 text-center text-slate-500">Enviando {progress.sent}/{progress.total} itens ({Math.round(progress.total > 0 ? (progress.sent / progress.total) * 100 : 0)}%)</p>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} disabled={isImporting} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl">Cancelar</button>
        <button onClick={onConfirm} disabled={isImporting} className={`flex-1 py-4 ${isImporting ? 'bg-slate-400' : 'bg-indigo-600'} text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all`}>{isImporting ? 'Enviando...' : 'Confirmar e Importar'}</button>
      </div>
    </div>
  </div>
);

const CashKpi = ({ label, value, icon, color, sub }: any) => {
  const colors: any = { emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800', rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800', amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{financial.formatVisual(value, 'R$')}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
};

const FinancialSummary = ({ stats, currencySymbol }: { stats: any, currencySymbol?: string }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2"><PieChart size={16} /> Composição das Saídas</h3>
      <div className="flex flex-col items-center">
        <div className="relative w-40 h-40 mb-8">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-blue-500" strokeDasharray={`${stats.distribution.labor * 2.51} 251`} />
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-indigo-600" strokeDasharray={`${stats.distribution.material * 2.51} 251`} strokeDashoffset={`${-stats.distribution.labor * 2.51}`} />
          </svg>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-[10px] font-black uppercase text-slate-500">Mão de Obra</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-600" /><span className="text-[10px] font-black uppercase text-slate-500">Materiais</span></div>
        </div>
      </div>
    </div>
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2"><BarChart3 size={16} /> Totais por Tipo</h3>
      <div className="grid grid-cols-1 gap-6">
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Mao de Obra</span>
            </div>
            <span className="text-sm font-black text-blue-600">{financial.formatVisual(stats.labor, currencySymbol)}</span>
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-3 h-3 rounded-full bg-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-widest">Materiais</span>
            </div>
            <span className="text-sm font-black text-indigo-600">{financial.formatVisual(stats.material, currencySymbol)}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TabTrigger = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-500 dark:text-slate-300'}`}>{icon} {label}</button>
);
