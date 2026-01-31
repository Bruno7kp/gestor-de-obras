
import React, { useState, useMemo, useRef } from 'react';
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
  ShoppingBag, 
  Users, 
  Truck, 
  ArrowUpRight,
  TrendingDown,
  Layers,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Wallet,
  ArrowRightLeft,
  X,
  AlertCircle
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
  isReadOnly?: boolean;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({ 
  project, expenses, onAdd, onAddMany, onUpdate, onDelete, workItems, measuredValue, isReadOnly 
}) => {
  const [activeTab, setActiveTab] = useState<ExpenseType>('material');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ExpenseImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItemType, setModalItemType] = useState<ItemType>('item');
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const currentExpenses = useMemo(() => {
    const filtered = expenses.filter(e => e.type === activeTab);
    const tree = treeService.buildTree(filtered);
    return tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
  }, [expenses, activeTab]);

  const flattenedExpenses = useMemo(() => 
    treeService.flattenTree(currentExpenses, expandedIds)
  , [currentExpenses, expandedIds]);

  const stats = useMemo(() => expenseService.getExpenseStats(expenses), [expenses]);
  const paidTotal = useMemo(() => financial.sum(expenses.filter(e => e.isPaid && e.itemType === 'item' && (e.type === 'labor' || e.type === 'material')).map(e => e.amount)), [expenses]);

  const handleImportExpenses = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const res = await excelService.parseExpensesExcel(file, activeTab);
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
    if (editingExpense) {
      onUpdate(editingExpense.id, data);
    } else {
      const parentId = targetParentId || data.parentId || null;
      const newExpense: ProjectExpense = {
        id: crypto.randomUUID(),
        parentId,
        type: activeTab,
        itemType: data.itemType || 'item',
        wbs: '',
        order: (expenses.filter(e => e.parentId === parentId && e.type === activeTab).length),
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || (activeTab === 'revenue' ? 'Nova Receita' : 'Novo Gasto'),
        entityName: data.entityName || (activeTab === 'revenue' ? 'Cliente' : 'Fornecedor'),
        unit: data.unit || (activeTab === 'revenue' ? 'vb' : 'un'),
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
      
      {/* DASHBOARD FINANCEIRO (CASH FLOW) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className={`p-6 sm:p-8 rounded-[2.5rem] border shadow-xl transition-all relative overflow-hidden flex flex-col justify-between ${stats.balance >= 0 ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg"><Wallet size={20}/></div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Saldo em Caixa Real</span>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black tracking-tighter leading-none">{financial.formatBRL(stats.balance)}</p>
            <p className="text-[10px] font-bold uppercase mt-2 opacity-70">Recursos disponíveis na obra</p>
          </div>
        </div>

        <KpiSummary label="Total Recebido" value={stats.revenue} icon={<ArrowRightLeft size={20}/>} color="emerald" subText="Pagamentos de Medições" />
        <KpiSummary label="Total Gasto" value={stats.totalOut} icon={<TrendingDown size={20}/>} color="rose" subText="Mat + MO Consolidado" />
        <KpiSummary label="Total Liquidado" value={paidTotal} icon={<CheckCircle2 size={20}/>} color="blue" subText="Pagamentos já realizados" />
      </div>

      {/* TOOLBAR FINANCEIRA */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 overflow-x-auto no-scrollbar">
          <TabTrigger active={activeTab === 'revenue'} onClick={() => setActiveTab('revenue')} label="Receitas" icon={<ArrowRightLeft size={14}/>} />
          <TabTrigger active={activeTab === 'material'} onClick={() => setActiveTab('material')} label="Materiais" icon={<Truck size={14}/>} />
          <TabTrigger active={activeTab === 'labor'} onClick={() => setActiveTab('labor')} label="Mão de Obra" icon={<Users size={14}/>} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setModalItemType('item'); setEditingExpense(null); setIsModalOpen(true); }} className="px-5 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg">
             {activeTab === 'revenue' ? 'Registrar Receita' : 'Novo Gasto'}
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
          <button onClick={() => excelService.downloadExpenseTemplate()} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors" title="Template Excel">
            <FileSpreadsheet size={18}/>
          </button>
          <button 
            disabled={isReadOnly || isImporting}
            onClick={() => fileInputRef.current?.click()} 
            className="p-2.5 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-30" 
            title="Importar"
          >
            {isImporting ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={18}/>}
          </button>
          <button onClick={() => excelService.exportExpensesToExcel(project, flattenedExpenses)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar">
            <Download size={18}/>
          </button>
        </div>
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
          if (exp) onUpdate(id, { amount: total, unitPrice: financial.round(total / (exp.quantity || 1)) });
        }}
        onTogglePaid={id => {
          const exp = expenses.find(e => e.id === id);
          if (exp) onUpdate(id, { isPaid: !exp.isPaid });
        }}
        isReadOnly={isReadOnly}
      />

      {/* MODAL DE REVISÃO DE IMPORTAÇÃO FINANCEIRA */}
      {importSummary && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
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
              <button onClick={() => setImportSummary(null)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={20} /></button>
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

              {importSummary.errors.length > 0 && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-rose-500 shrink-0" size={18} />
                  <div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">Inconsistências</p>
                    <ul className="text-[9px] font-bold text-rose-500 space-y-0.5">
                      {importSummary.errors.map((err, i) => <li key={i}>• {err}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 font-medium text-center px-4">
                Estes registros serão anexados à sua lista de {activeTab === 'revenue' ? 'receitas' : 'despesas'} atual. Verifique se os fornecedores e datas estão corretos.
              </p>
            </div>

            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <button onClick={confirmImport} className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> Confirmar Lançamentos
              </button>
              <button onClick={() => setImportSummary(null)} className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <ExpenseModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveExpense}
        editingItem={editingExpense}
        expenseType={activeTab}
        itemType={modalItemType}
        categories={expenses.filter(e => e.type === activeTab && e.itemType === 'category')}
      />
    </div>
  );
};

const TabTrigger = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>
    {icon} {label}
  </button>
);

const KpiSummary = ({ label, value, icon, color, subText }: any) => {
  const colors: any = { indigo: 'text-indigo-600', emerald: 'text-emerald-600', rose: 'text-rose-600', blue: 'text-blue-600' };
  return (
    <div className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl sm:text-2xl font-black tracking-tighter ${colors[color]}`}>{financial.formatBRL(value)}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{subText}</p>
      </div>
    </div>
  );
};
