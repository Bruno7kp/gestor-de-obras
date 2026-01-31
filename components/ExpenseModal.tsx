
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType } from '../types';
import { financial } from '../utils/math';
import { X, Save, Layers, Truck, Users, Calculator, ArrowRightLeft } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProjectExpense>) => void;
  editingItem: ProjectExpense | null;
  expenseType: ExpenseType;
  itemType: ItemType;
  categories: ProjectExpense[];
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen, onClose, onSave, editingItem, expenseType, itemType: initialItemType, categories
}) => {
  const [activeItemType, setActiveItemType] = useState<ItemType>(initialItemType);
  const [formData, setFormData] = useState<Partial<ProjectExpense>>({
    description: '', parentId: null, unit: 'un', quantity: 1, unitPrice: 0, amount: 0, entityName: '', date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
      setActiveItemType(editingItem.itemType);
    } else {
      setFormData({ 
        description: '', parentId: null, 
        unit: expenseType === 'labor' ? 'h' : (expenseType === 'revenue' ? 'vb' : 'un'), 
        quantity: 1, unitPrice: 0, amount: 0, entityName: '', 
        date: new Date().toISOString().split('T')[0] 
      });
      setActiveItemType(initialItemType);
    }
  }, [editingItem, initialItemType, isOpen, expenseType]);

  const updateCalculations = (field: 'qty' | 'price' | 'amount', value: number) => {
    const updated = { ...formData };
    if (field === 'qty') {
      updated.quantity = value;
      updated.amount = financial.round(value * (updated.unitPrice || 0));
    } else if (field === 'price') {
      updated.unitPrice = value;
      updated.amount = financial.round((updated.quantity || 1) * value);
    } else if (field === 'amount') {
      updated.amount = value;
      updated.unitPrice = financial.round(value / (updated.quantity || 1));
    }
    setFormData(updated);
  };

  const handleSubmit = () => {
    if (!formData.description) return;
    const finalData = {
      ...formData,
      itemType: activeItemType,
      type: expenseType,
      amount: activeItemType === 'item' ? (formData.amount || 0) : 0
    };
    onSave(finalData);
    onClose();
  };

  if (!isOpen) return null;

  const isRevenue = expenseType === 'revenue';

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isRevenue ? 'bg-emerald-600' : (expenseType === 'labor' ? 'bg-blue-600' : 'bg-indigo-600')} text-white`}>
              {isRevenue ? <ArrowRightLeft size={22} /> : (expenseType === 'labor' ? <Users size={22} /> : <Truck size={22} />)}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Novo'} {isRevenue ? 'Recebimento' : (expenseType === 'labor' ? 'Gasto de MO' : 'Gasto de Material')}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{isRevenue ? 'Fluxo de Entrada em Caixa' : 'Controle de Insumos e Descontos'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
          {!editingItem && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-2">
              <button onClick={() => setActiveItemType('category')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'category' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>Categoria/Grupo</button>
              <button onClick={() => setActiveItemType('item')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'item' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>{isRevenue ? 'Lançar Valor' : 'Gasto Individual'}</button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Descrição / Título</label>
              <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-sm font-semibold outline-none focus:border-indigo-500 transition-all" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            {activeItemType === 'item' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">{isRevenue ? 'Pagador / Origem' : 'Fornecedor / Profissional'}</label>
                  <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all" value={formData.entityName} onChange={e => setFormData({...formData, entityName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Quantidade</label>
                  <input type="number" step="any" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold text-center outline-none focus:border-indigo-500 transition-all" value={formData.quantity} onChange={e => updateCalculations('qty', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Preço Unitário</label>
                  <input type="number" step="any" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold text-right outline-none focus:border-indigo-500 transition-all" value={formData.unitPrice} onChange={e => updateCalculations('price', parseFloat(e.target.value) || 0)} />
                </div>
                
                {/* CAMPO DE VALOR TOTAL EDITÁVEL */}
                <div className={`col-span-2 pt-4 p-6 rounded-3xl border-2 border-dashed ${isRevenue ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800'}`}>
                  <label className={`text-[10px] font-black ${isRevenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'} uppercase mb-2 block tracking-widest text-center`}>{isRevenue ? 'Valor Líquido Recebido' : 'Valor Total Pago (Com Desconto)'}</label>
                  <div className="relative">
                    <Calculator className={`absolute left-4 top-1/2 -translate-y-1/2 ${isRevenue ? 'text-emerald-400' : 'text-indigo-400'}`} size={18} />
                    <input 
                      type="number" 
                      step="any"
                      className={`w-full pl-12 pr-4 py-4 rounded-2xl border-2 ${isRevenue ? 'border-emerald-200 dark:border-emerald-900 focus:border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-indigo-200 dark:border-indigo-900 focus:border-indigo-600 text-indigo-700 dark:text-indigo-300'} bg-white dark:bg-slate-950 text-xl font-black text-right outline-none transition-all`} 
                      value={formData.amount} 
                      onChange={e => updateCalculations('amount', parseFloat(e.target.value) || 0)} 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-700 dark:hover:text-slate-200 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} className={`px-10 py-4 ${isRevenue ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'} text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2`}>
            <Save size={18} /> {editingItem ? 'Salvar Alterações' : (isRevenue ? 'Registrar Receita' : 'Salvar Gasto')}
          </button>
        </div>
      </div>
    </div>
  );
};
