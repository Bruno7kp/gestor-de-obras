
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProjectExpense, ExpenseType, WorkItem, ItemType, Project } from '../types';
import { financial } from '../utils/math';
import { expenseService } from '../services/expenseService';
import { treeService } from '../services/treeService';
import { excelService, ExpenseImportResult } from '../services/excelService';
import { projectExpensesApi } from '../services/projectExpensesApi';
import { ExpenseTreeTable } from './ExpenseTreeTable';
import { ExpenseModal } from './ExpenseModal';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import {
  Plus, Search, CheckCircle2, Wallet, ArrowRightLeft,
  X, BarChart3, PieChart, Clock, ArrowUpRight,
  Maximize2, Minimize2, Truck, Users, Download, UploadCloud,
  FileSpreadsheet, Landmark, Coins, AlertCircle, Printer, FolderPlus, Lock
} from 'lucide-react';

interface ExpenseManagerProps {
  project: Project;
  expenses: ProjectExpense[];
  onAdd: (expense: ProjectExpense) => void;
  onAddMany: (expenses: ProjectExpense[]) => void;
  onUpdate: (id: string, data: Partial<ProjectExpense>) => void;
  onDelete: (id: string) => void;
  workItems: WorkItem[];
  measuredValue: number;
  onUpdateExpenses: (expenses: ProjectExpense[]) => void;
  isReadOnly?: boolean;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  project, expenses, onAdd, onAddMany, onUpdate, onDelete, workItems, measuredValue, onUpdateExpenses, isReadOnly
}) => {
  const { canEdit, getLevel } = usePermissions();
  const toast = useToast();
  const canEditFinancial = canEdit('financial_flow') && !isReadOnly;
  const isSupplyLinkedExpense = (expense: ProjectExpense) =>
    expense.type === 'material' &&
    expense.itemType === 'item' &&
    /^Pedido (Pendente|Pago|Entregue): /.test(expense.description);

  const expenseTabs: Array<ExpenseType | 'overview'> = ['overview', 'revenue', 'material', 'labor'];
  const expenseTabKey = `exp_fin_tab_${project.id}`;
  const [activeTab, setActiveTab] = useState<ExpenseType | 'overview'>(() => {
    const saved = uiPreferences.getString(expenseTabKey);
    return saved && expenseTabs.includes(saved as ExpenseType | 'overview')
      ? (saved as ExpenseType | 'overview')
      : 'overview';
  });
  const [searchQuery, setSearchQuery] = useState('');
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

  const stats = useMemo(() => expenseService.getExpenseStats(expenses), [expenses]);

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
    const filtered = expenses.filter(e => e.type === activeTab);
    const tree = treeService.buildTree(filtered);
    return tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
  }, [expenses, activeTab]);

  const flattenedExpenses = useMemo(() =>
    treeService.flattenTree(currentExpenses, expandedIds)
    , [currentExpenses, expandedIds]);

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

  const handleSaveExpense = (data: Partial<ProjectExpense>) => {
    if (editingExpense) {
      onUpdate(editingExpense.id, data);
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
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportExpenses} />

      {!canEditFinancial && !isReadOnly && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">Você tem apenas permissão de leitura. Para editar despesas, solicite acesso ao administrador.</span>
        </div>
      )}

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
        </div>

        <div className="flex items-center gap-2">
          {activeTab !== 'overview' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setModalItemType('category'); setEditingExpense(null); setTargetParentId(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all"
              >
                <FolderPlus size={14} /> Criar Grupo
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all"
          >
            <Printer size={16} /> PDF
          </button>

          <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-emerald-600" title="Importar Excel"><UploadCloud size={18} /></button>
          <button onClick={() => excelService.exportExpensesToExcel(project, expenses, activeTab === 'overview' ? undefined : activeTab as ExpenseType)} className="p-2.5 text-slate-400 hover:text-blue-600" title="Exportar Excel"><Download size={18} /></button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <FinancialSummary stats={stats} currencySymbol={project.theme?.currencySymbol} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setExpandedIds(new Set(expenses.map(e => e.id)))} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50"><Maximize2 size={12} className="inline mr-1" /> Expandir</button>
            <button onClick={() => setExpandedIds(new Set())} className="px-3 py-1.5 text-[9px] font-black uppercase text-slate-500 border rounded-lg hover:bg-slate-50"><Minimize2 size={12} className="inline mr-1" /> Recolher</button>
          </div>

          <ExpenseTreeTable
            data={flattenedExpenses}
            expandedIds={expandedIds}
            onToggle={id => {
              setExpandedIds((prev: Set<string>) => {
                const next = new Set<string>(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              });
            }}
            onEdit={expense => { setEditingExpense(expense); setIsModalOpen(true); }}
            onDelete={onDelete}
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
            onReorder={(src, tgt, pos) => onUpdateExpenses(treeService.reorderItems(expenses, src, tgt, pos))}
            onMoveManual={(id, dir) => onUpdateExpenses(treeService.moveInSiblings(expenses, id, dir))}
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
        expenseType={activeTab === 'overview' ? 'material' : (activeTab as ExpenseType)}
        itemType={modalItemType}
        categories={processedExpenseCategories as any}
        currencySymbol={project.theme?.currencySymbol || 'R$'}
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

      <div className="grid grid-cols-3 gap-4">
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
      </div>

      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex gap-3">
        <AlertCircle size={20} className="text-amber-500 shrink-0" />
        <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-tight">
          Ao confirmar, os registros de Mão de Obra, Materiais e Receitas do sistema serão **SUBSTITUÍDOS** pelos dados desta planilha para evitar duplicações.
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
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2"><BarChart3 size={16} /> Fluxo de Liquidação</h3>
      <div className="space-y-8">
        <div>
          <div className="flex justify-between text-[10px] font-black uppercase mb-2"><span>Total Pago</span><span className="text-rose-600">{financial.formatVisual(stats.paidOut, currencySymbol)}</span></div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-rose-50" style={{ width: `${stats.totalOut > 0 ? (stats.paidOut / stats.totalOut) * 100 : 0}%` }} /></div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] font-black uppercase mb-2"><span>A Pagar Pendente</span><span className="text-amber-600">{financial.formatVisual(stats.unpaidOut, currencySymbol)}</span></div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-50" style={{ width: `${stats.totalOut > 0 ? (stats.unpaidOut / stats.totalOut) * 100 : 0}%` }} /></div>
        </div>
      </div>
    </div>
  </div>
);

const TabTrigger = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>{icon} {label}</button>
);
