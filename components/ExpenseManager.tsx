
import React, { useState, useMemo } from 'react';
import { ProjectExpense, ExpenseType, WorkItem, ItemType } from '../types';
import { financial } from '../utils/math';
import { expenseService } from '../services/expenseService';
import { treeService } from '../services/treeService';
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
  Layers
} from 'lucide-react';

interface ExpenseManagerProps {
  expenses: ProjectExpense[];
  onAdd: (expense: ProjectExpense) => void;
  onUpdate: (id: string, data: Partial<ProjectExpense>) => void;
  onDelete: (id: string) => void;
  workItems: WorkItem[];
  measuredValue: number;
  isReadOnly?: boolean;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({ 
  expenses, onAdd, onUpdate, onDelete, workItems, measuredValue, isReadOnly 
}) => {
  const [activeTab, setActiveTab] = useState<ExpenseType>('material');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  
  // Estados de Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItemType, setModalItemType] = useState<ItemType>('item');
  const [editingExpense, setEditingExpense] = useState<ProjectExpense | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // Filtra gastos pelo tipo da aba e processa árvore
  const currentExpenses = useMemo(() => {
    const filtered = expenses.filter(e => e.type === activeTab);
    const tree = treeService.buildTree(filtered);
    return tree.map((root, idx) => treeService.processExpensesRecursive(root as ProjectExpense, '', idx));
  }, [expenses, activeTab]);

  const flattenedExpenses = useMemo(() => 
    treeService.flattenTree(currentExpenses, expandedIds)
  , [currentExpenses, expandedIds]);

  const stats = useMemo(() => expenseService.getExpenseStats(expenses), [expenses]);
  const marginValue = financial.round(measuredValue - stats.total);
  const marginPercent = measuredValue > 0 ? (marginValue / measuredValue) * 100 : 0;

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
        description: data.description || 'Novo Gasto',
        entityName: data.entityName || '',
        unit: data.unit || 'un',
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice || 0,
        amount: (data.quantity || 0) * (data.unitPrice || 0),
        linkedWorkItemId: data.linkedWorkItemId
      };
      onAdd(newExpense);
      if (parentId) setExpandedIds(prev => new Set([...prev, parentId]));
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">
      
      {/* DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KpiSummary label="Total Geral" value={stats.total} icon={<DollarSign size={20}/>} color="indigo" subText={`${stats.materialPercentage.toFixed(0)}% Mat / ${stats.laborPercentage.toFixed(0)}% MO`} />
        <KpiSummary label="Materiais" value={stats.material} icon={<ShoppingBag size={20}/>} color="emerald" subText="Subtotal Materiais" />
        <KpiSummary label="Mão de Obra" value={stats.labor} icon={<Users size={20}/>} color="blue" subText="Subtotal MO" />
        <div className={`p-6 sm:p-8 rounded-[2rem] border shadow-sm transition-all relative overflow-hidden flex flex-col justify-between ${marginValue >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Margem Estimada</span>
            {marginValue >= 0 ? <ArrowUpRight className="text-emerald-500" size={18}/> : <TrendingDown className="text-rose-500" size={18}/>}
          </div>
          <div>
            <p className={`text-xl sm:text-2xl font-black tracking-tighter ${marginValue >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{financial.formatBRL(marginValue)}</p>
            <p className="text-[10px] font-bold uppercase mt-1 opacity-60">{marginPercent.toFixed(1)}% margem</p>
          </div>
        </div>
      </div>

      {/* CONTROLES */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2">
          <TabTrigger active={activeTab === 'material'} onClick={() => { setActiveTab('material'); setExpandedIds(new Set()); }} label="Materiais" icon={<Truck size={14}/>} />
          <TabTrigger active={activeTab === 'labor'} onClick={() => { setActiveTab('labor'); setExpandedIds(new Set()); }} label="Mão de Obra" icon={<Users size={14}/>} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setModalItemType('item'); setEditingExpense(null); setTargetParentId(null); setIsModalOpen(true); }} className="px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg flex items-center justify-center gap-2">
            <Plus size={16} /> Novo Gasto
          </button>
          <button onClick={() => { setModalItemType('category'); setEditingExpense(null); setTargetParentId(null); setIsModalOpen(true); }} className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2">
            <Layers size={16} /> Novo Grupo
          </button>
        </div>
      </div>

      {/* TABELA DE ÁRVORE DE GASTOS */}
      <ExpenseTreeTable 
        data={flattenedExpenses}
        expandedIds={expandedIds}
        onToggle={id => { const n = new Set(expandedIds); n.has(id) ? n.delete(id) : n.add(id); setExpandedIds(n); }}
        onEdit={expense => { setEditingExpense(expense); setModalItemType(expense.itemType); setIsModalOpen(true); }}
        onDelete={onDelete}
        onAddChild={(pid, itype) => { setTargetParentId(pid); setModalItemType(itype); setEditingExpense(null); setIsModalOpen(true); }}
        isReadOnly={isReadOnly}
      />

      {/* MODAL DE GASTOS */}
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
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>
    {icon} {label}
  </button>
);

const KpiSummary = ({ label, value, icon, color, subText }: any) => {
  const colors: any = { indigo: 'text-indigo-600', emerald: 'text-emerald-600', blue: 'text-blue-600' };
  return (
    <div className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg">{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl sm:text-2xl font-black tracking-tighter ${colors[color]}`}>{financial.formatBRL(value)}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{subText}</p>
      </div>
    </div>
  );
};
