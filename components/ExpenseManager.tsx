
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProjectExpense, ExpenseType, WorkItem, ItemType, Project } from '../types';
import { financial } from '../utils/math';
import { expenseService } from '../services/expenseService';
import { treeService } from '../services/treeService';
import { excelService, ExpenseImportResult } from '../services/excelService';
import { ExpenseTreeTable } from './ExpenseTreeTable';
import { ExpenseModal } from './ExpenseModal';
import { 
  Plus, 
  Search, 
  DollarSign, 
  Users, 
  Truck, 
  TrendingDown,
  Layers,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Wallet,
  ArrowRightLeft,
  X,
  AlertCircle,
  BarChart3,
  PieChart,
  Clock,
  ArrowUpRight,
  Maximize2,
  Minimize2
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
  const [activeTab, setActiveTab] = useState<ExpenseType | 'overview'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Persistência da expansão financeira por projeto
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`exp_fin_${project.id}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
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

  const stats = useMemo(() => expenseService.getExpenseStats(expenses), [expenses]);

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
      const typeForImport = activeTab === 'overview' ? 'material' : activeTab;
      const res = await excelService.parseExpensesExcel(file, typeForImport);
      setImportSummary(res);
    } catch (err) {
      alert("Erro ao importar despesas. Verifique o arquivo.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = () => {
    if (!importSummary) return;
    onAddMany(importSummary.expenses);
    const cats = importSummary.expenses.filter(ex => ex.itemType === 'category').map(ex => ex.id);
    setExpandedIds(new Set([...Array.from(expandedIds), ...cats]));
    setImportSummary(null);
  };

  const handleSaveExpense = (data: Partial<ProjectExpense>) => {
    const typeForNew = activeTab === 'overview' ? 'material' : activeTab;
    if (editingExpense) {
      onUpdate(editingExpense.id, data);
    } else {
      const parentId = targetParentId || data.parentId || null;
      const newExpense: ProjectExpense = {
        id: crypto.randomUUID(),
        parentId,
        type: typeForNew,
        itemType: data.itemType || 'item',
        wbs: '',
        order: (expenses.filter(e => e.parentId === parentId && e.type === typeForNew).length),
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || (typeForNew === 'revenue' ? 'Nova Receita' : 'Insumo / Despesa'),
        entityName: data.entityName || (typeForNew === 'revenue' ? 'Cliente' : 'Fornecedor'),
        unit: data.unit || (typeForNew === 'revenue' ? 'vb' : 'un'),
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice || 0,
        amount: (data.amount || 0),
        isPaid: data.isPaid || false
      };
      onAdd(newExpense);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-[1600px] mx-auto pb-10">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportExpenses} />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiSummary label="Receita Total" value={stats.revenue} icon={<ArrowRightLeft size={20}/>} color="emerald" subText="Entradas Confirmadas" />
        <KpiSummary label="Custo Total" value={stats.totalOut} icon={<TrendingDown size={20}/>} color="rose" subText="Comprometido MO+Mat" />
        <KpiSummary label="Valor Pago" value={stats.paidOut} icon={<CheckCircle2 size={20}/>} color="blue" subText="Liquidado" />
        <KpiSummary label="A Pagar" value={stats.unpaidOut} icon={<Clock size={20}/>} color="amber" subText="Pendente" />
        
        <div className={`p-6 rounded-[2rem] border shadow-xl transition-all flex flex-col justify-between ${stats.profit >= 0 ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg"><Wallet size={20}/></div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Resultado Líquido</span>
          </div>
          <div>
            <p className="text-2xl font-black tracking-tighter leading-none">{financial.formatBRL(stats.profit)}</p>
            <p className="text-[10px] font-bold uppercase mt-2 opacity-70">Margem: {stats.marginPercent.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          <TabTrigger active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Panorama" icon={<BarChart3 size={14}/>} />
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center mx-1" />
          <TabTrigger active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} label="Receitas" icon={<ArrowUpRight size={14}/>} />
          <TabTrigger active={activeTab === 'material'} onClick={() => setActiveTab('material')} label="Materiais" icon={<Truck size={14}/>} />
          <TabTrigger active={activeTab === 'labor'} onClick={() => setActiveTab('labor')} label="Mão de Obra" icon={<Users size={14}/>} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab !== 'overview' && (
            <button type="button" onClick={() => { setModalItemType('item'); setEditingExpense(null); setIsModalOpen(true); }} className="px-5 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg hover:scale-105 transition-transform active:scale-95">
               {activeTab === 'revenue' ? 'Nova Receita' : 'Novo Insumo'}
            </button>
          )}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button type="button" onClick={() => excelService.downloadExpenseTemplate()} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Template Excel">
            <FileSpreadsheet size={18}/>
          </button>
          <button type="button" disabled={isReadOnly || isImporting} onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-30" title="Importar">
            {isImporting ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={18}/>}
          </button>
          {activeTab !== 'overview' && (
            <button type="button" onClick={() => excelService.exportExpensesToExcel(project, expenses)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar">
              <Download size={18}/>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'overview' ? (
        <FinancialOverview stats={stats} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 no-print">
            <button 
              onClick={() => setExpandedIds(new Set(expenses.filter(e => e.itemType === 'category' && e.type === activeTab).map(e => e.id)))} 
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-all shadow-sm"
            >
              <Maximize2 size={12} /> Expandir Tudo
            </button>
            <button 
              onClick={() => setExpandedIds(new Set())} 
              className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-all shadow-sm"
            >
              <Minimize2 size={12} /> Recolher Tudo
            </button>
          </div>
          
          <ExpenseTreeTable 
            data={flattenedExpenses}
            expandedIds={expandedIds}
            onToggle={id => { const n = new Set(expandedIds); n.has(id) ? n.delete(id) : n.add(id); setExpandedIds(n); }}
            onEdit={expense => { setEditingExpense(expense); setIsModalOpen(true); }}
            onDelete={onDelete}
            onAddChild={(pid, itype) => { setTargetParentId(pid); setModalItemType(itype); setIsModalOpen(true); }}
            onUpdateTotal={(id, total) => {
              const exp = expenses.find(e => e.id === id);
              if (exp) onUpdate(id, { 
                amount: total, 
                unitPrice: financial.round(total / (exp.quantity || 1)) 
              });
            }}
            onUpdateUnitPrice={(id, price) => {
              const exp = expenses.find(e => e.id === id);
              if (exp) onUpdate(id, { 
                unitPrice: price, 
                amount: financial.round(price * (exp.quantity || 0)) 
              });
            }}
            onTogglePaid={id => {
              const exp = expenses.find(e => e.id === id);
              if (exp) onUpdate(id, { isPaid: !exp.isPaid });
            }}
            onReorder={(src, tgt, pos) => onUpdateExpenses(treeService.reorderItems(expenses, src, tgt, pos))}
            isReadOnly={isReadOnly}
          />
        </div>
      )}

      {importSummary && (
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setImportSummary(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black dark:text-white tracking-tight">Revisar Gastos</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lançamentos Identificados</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setImportSummary(null)} 
                className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                  <div className="flex justify-center mb-2 text-indigo-500"><Layers size={20}/></div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{importSummary.stats.categories}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Categorias</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
                  <div className="flex justify-center mb-2 text-emerald-500"><DollarSign size={20}/></div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white">{importSummary.stats.items}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lançamentos</p>
                </div>
              </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <button 
                type="button" 
                onClick={confirmImport} 
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Confirmar Lançamentos
              </button>
            </div>
          </div>
        </div>
      )}

      <ExpenseModal 
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveExpense} editingItem={editingExpense} expenseType={activeTab === 'overview' ? 'material' : activeTab} itemType={modalItemType} categories={expenses.filter(e => e.type === (activeTab === 'overview' ? 'material' : activeTab) && e.itemType === 'category')}
      />
    </div>
  );
};

const FinancialOverview = ({ stats }: { stats: any }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl"><PieChart size={20} /></div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Distribuição de Custos</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Insumos vs Mão de Obra</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-6">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-blue-500" strokeDasharray={`${stats.distribution.labor * 2.51} 251`} />
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="12" className="text-indigo-600" strokeDasharray={`${stats.distribution.material * 2.51} 251`} strokeDashoffset={`${-stats.distribution.labor * 2.51}`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Gasto</span>
            <span className="text-lg font-black dark:text-white">{financial.formatBRL(stats.totalOut)}</span>
          </div>
        </div>
      </div>
    </div>
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl"><BarChart3 size={20} /></div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">Saúde Financeira</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Entradas vs Saídas</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center space-y-10">
         <div className="space-y-4">
            <div className="flex justify-between items-end"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Recebido</span><span className="text-sm font-black text-emerald-600">{financial.formatBRL(stats.revenue)}</span></div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-full" /></div>
         </div>
         <div className="space-y-4">
            <div className="flex justify-between items-end"><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custos Consolidados</span><span className="text-sm font-black text-rose-500">{financial.formatBRL(stats.totalOut)}</span></div>
            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${stats.revenue > 0 ? Math.min(100, (stats.totalOut / stats.revenue) * 100) : 0}%` }} /></div>
         </div>
      </div>
    </div>
  </div>
);

const TabTrigger = ({ active, onClick, label, icon }: any) => (
  <button type="button" onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>{icon} {label}</button>
);

const KpiSummary = ({ label, value, icon, color, subText }: any) => {
  const colors: any = { indigo: 'text-indigo-600 dark:text-indigo-400', emerald: 'text-emerald-600 dark:text-emerald-400', rose: 'text-rose-600 dark:text-rose-400', blue: 'text-blue-600 dark:text-blue-400', amber: 'text-amber-600 dark:text-amber-400' };
  return (
    <div className="p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</span>
      </div>
      <div><p className={`text-xl font-black tracking-tighter ${colors[color]}`}>{financial.formatBRL(value)}</p><p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">{subText}</p></div>
    </div>
  );
};
