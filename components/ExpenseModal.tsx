
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType } from '../types';
import { financial } from '../utils/math';
import { X, Save, Layers, Truck, Users } from 'lucide-react';

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
    description: '', parentId: null, unit: 'un', quantity: 1, unitPrice: 0, entityName: '', date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
      setActiveItemType(editingItem.itemType);
    } else {
      setFormData({ 
        description: '', parentId: null, 
        unit: expenseType === 'labor' ? 'h' : 'un', 
        quantity: 1, unitPrice: 0, entityName: '', 
        date: new Date().toISOString().split('T')[0] 
      });
      setActiveItemType(initialItemType);
    }
  }, [editingItem, initialItemType, isOpen, expenseType]);

  const handleSubmit = () => {
    if (!formData.description) return;
    const finalData = {
      ...formData,
      itemType: activeItemType,
      type: expenseType,
      amount: activeItemType === 'item' ? (formData.quantity || 0) * (formData.unitPrice || 0) : 0
    };
    onSave(finalData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${expenseType === 'labor' ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
              {expenseType === 'labor' ? <Users size={22} /> : <Truck size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Novo'} {expenseType === 'labor' ? 'Gasto com MO' : 'Gasto com Material'}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Controle de Insumos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          {!editingItem && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-2">
              <button onClick={() => setActiveItemType('category')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'category' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>Categoria/Grupo</button>
              <button onClick={() => setActiveItemType('item')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'item' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-500'}`}>Gasto Individual</button>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Descrição</label>
              <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-indigo-500 transition-all" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Nível Superior</label>
              <select className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold outline-none appearance-none" value={formData.parentId || ""} onChange={e => setFormData({...formData, parentId: e.target.value || null})}>
                <option value="">Raiz</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.wbs} - {cat.description}</option>)}
              </select>
            </div>

            {activeItemType === 'item' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Fornecedor / Profissional</label>
                  <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold outline-none" value={formData.entityName} onChange={e => setFormData({...formData, entityName: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Data</label>
                  <input type="date" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Unidade</label>
                  <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold text-center outline-none" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Quantidade</label>
                  <input type="number" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold text-center outline-none" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Preço Unitário</label>
                  <input type="number" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-bold text-right outline-none" value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cancelar</button>
          <button onClick={handleSubmit} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2">
            <Save size={18} /> {editingItem ? 'Atualizar' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};
