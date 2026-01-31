
import React, { useState, useEffect } from 'react';
import { WorkItem, ItemType } from '../types';
import { financial } from '../utils/math';
import { X, Save, Layers, Package, Calculator, FolderTree } from 'lucide-react';
import { z } from 'zod';

const WorkItemSchema = z.object({
  name: z.string().min(3, "Mínimo 3 letras").max(200, "Muito longo"),
  type: z.enum(['category', 'item']),
  parentId: z.string().nullable().optional(),
  unit: z.string().optional(),
  contractQuantity: z.number().min(0, "Mínimo 0"),
  unitPriceNoBdi: z.number().min(0, "Mínimo 0"),
  unitPrice: z.number().min(0, "Mínimo 0"),
  currentPercentage: z.number().min(0).max(100).optional(),
}).refine((data) => data.type === 'category' || (data.unit && data.unit.trim().length > 0), {
  message: "Unidade obrigatória",
  path: ["unit"],
});

interface WorkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<WorkItem>) => void;
  editingItem: WorkItem | null;
  type: ItemType;
  categories: WorkItem[];
  projectBdi: number;
}

export const WorkItemModal: React.FC<WorkItemModalProps> = ({
  isOpen, onClose, onSave, editingItem, type: initialType, categories, projectBdi
}) => {
  const [activeType, setActiveType] = useState<ItemType>(initialType);
  const [formData, setFormData] = useState<Partial<WorkItem>>({
    name: '', parentId: null, unit: '', contractQuantity: 0, unitPrice: 0, unitPriceNoBdi: 0, cod: '', fonte: 'Próprio'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [strQty, setStrQty] = useState('0');
  const [strPriceNoBdi, setStrPriceNoBdi] = useState('0');
  const [strPriceWithBdi, setStrPriceWithBdi] = useState('0');
  const [strTotalWithBdi, setStrTotalWithBdi] = useState('0');

  useEffect(() => {
    if (editingItem) {
      setFormData(editingItem);
      setActiveType(editingItem.type);
      setStrQty(String(editingItem.contractQuantity || 0).replace('.', ','));
      setStrPriceNoBdi(String(editingItem.unitPriceNoBdi || 0).replace('.', ','));
      setStrPriceWithBdi(String(editingItem.unitPrice || 0).replace('.', ','));
      setStrTotalWithBdi(String(editingItem.contractTotal || 0).replace('.', ','));
    } else {
      setFormData({ name: '', parentId: null, unit: initialType === 'item' ? 'un' : '', contractQuantity: 0, unitPrice: 0, unitPriceNoBdi: 0, cod: '', fonte: 'Próprio' });
      setActiveType(initialType);
      setStrQty('0'); setStrPriceNoBdi('0'); setStrPriceWithBdi('0'); setStrTotalWithBdi('0');
    }
    setErrors({});
  }, [editingItem, initialType, isOpen]);

  const parseInput = (val: string): number => {
    const normalized = val.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleNumericChange = (setter: (v: string) => void, val: string, field?: 'qty' | 'priceNoBdi' | 'priceWithBdi' | 'totalWithBdi') => {
    let sanitized = val.replace(/[^0-9.,]/g, '');
    if (sanitized.length > 1 && sanitized.startsWith('0') && sanitized[1] !== ',' && sanitized[1] !== '.') {
      sanitized = sanitized.substring(1);
    }
    setter(sanitized);

    const num = parseInput(sanitized);
    const currentQty = field === 'qty' ? num : parseInput(strQty);

    if (field === 'priceNoBdi') {
      const pWithBdi = financial.round(num * (1 + projectBdi/100));
      setStrPriceWithBdi(String(pWithBdi).replace('.', ','));
      setStrTotalWithBdi(String(financial.round(pWithBdi * currentQty)).replace('.', ','));
    } 
    else if (field === 'priceWithBdi') {
      const pNoBdi = financial.round(num / (1 + projectBdi/100));
      setStrPriceNoBdi(String(pNoBdi).replace('.', ','));
      setStrTotalWithBdi(String(financial.round(num * currentQty)).replace('.', ','));
    }
    else if (field === 'totalWithBdi') {
      if (currentQty > 0) {
        const pWithBdi = financial.round(num / currentQty);
        const pNoBdi = financial.round(pWithBdi / (1 + projectBdi/100));
        setStrPriceWithBdi(String(pWithBdi).replace('.', ','));
        setStrPriceNoBdi(String(pNoBdi).replace('.', ','));
      }
    }
    else if (field === 'qty') {
      const pWithBdi = parseInput(strPriceWithBdi);
      setStrTotalWithBdi(String(financial.round(pWithBdi * num)).replace('.', ','));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      type: activeType,
      contractQuantity: parseInput(strQty),
      unitPriceNoBdi: parseInput(strPriceNoBdi),
      unitPrice: parseInput(strPriceWithBdi)
    };
    
    const result = WorkItemSchema.safeParse(finalData);
    if (result.success) {
      onSave(finalData);
      onClose();
    } else {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => { if (issue.path[0]) newErrors[issue.path[0].toString()] = issue.message; });
      setErrors(newErrors);
    }
  };

  if (!isOpen) return null;
  const isCategory = activeType === 'category';

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl sm:rounded-[3rem] shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 sm:px-10 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${isCategory ? 'bg-indigo-600' : 'bg-emerald-600'} text-white`}>
              {isCategory ? <Layers size={22} /> : <Package size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Adicionar'} {isCategory ? 'Grupo' : 'Serviço'}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Nível de Hierarquia e Valores</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 sm:p-10 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {!editingItem && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2">
                <button type="button" onClick={() => setActiveType('category')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'category' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>Categoria/Grupo</button>
                <button type="button" onClick={() => setActiveType('item')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeType === 'item' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>Serviço/Item</button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Pertence ao Grupo (Hierarquia)</label>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <select 
                      className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-500 transition-all"
                      value={formData.parentId || ''}
                      onChange={e => setFormData({...formData, parentId: e.target.value || null})}
                    >
                      <option value="">Nível Raiz (Principal)</option>
                      {categories.filter(c => c.id !== editingItem?.id).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.wbs} - {cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Código Interno / Fonte</label>
                  <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all" value={formData.cod} onChange={e => setFormData({...formData, cod: e.target.value})} placeholder="Ex: SINAPI-93358" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Descrição do Serviço</label>
                <textarea autoFocus rows={3} className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-sm font-semibold outline-none focus:border-indigo-500 transition-all resize-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                {errors.name && <p className="text-[10px] text-rose-500 font-bold mt-2 uppercase">{errors.name}</p>}
              </div>

              {!isCategory && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Unidade</label>
                    <input placeholder="m², un, kg..." className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-black uppercase text-center outline-none focus:border-indigo-500 transition-all" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Quantidade</label>
                    <input type="text" inputMode="decimal" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-black text-center outline-none focus:border-indigo-500 transition-all" value={strQty} onChange={e => handleNumericChange(setStrQty, e.target.value, 'qty')} />
                  </div>
                  
                  <div className="col-span-2 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border-2 border-slate-100 dark:border-slate-800 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">P. Unit S/ BDI</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-600">R$</span>
                          <input type="text" inputMode="decimal" className="w-full pl-10 pr-4 py-4 rounded-xl border-2 border-white dark:border-slate-800 bg-white dark:bg-slate-950 dark:text-white text-xs font-black text-right outline-none focus:border-indigo-500 transition-all" value={strPriceNoBdi} onChange={e => handleNumericChange(setStrPriceNoBdi, e.target.value, 'priceNoBdi')} />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase mb-2 block tracking-widest">P. Unit C/ BDI</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-500/50">R$</span>
                          <input type="text" inputMode="decimal" className="w-full pl-10 pr-4 py-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/20 bg-emerald-50/30 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-black text-right outline-none focus:border-emerald-500 transition-all shadow-inner" value={strPriceWithBdi} onChange={e => handleNumericChange(setStrPriceWithBdi, e.target.value, 'priceWithBdi')} />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-2 block tracking-widest text-center">Valor Total Contratual</label>
                      <div className="relative max-w-sm mx-auto">
                        <Calculator className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                        <input type="text" inputMode="decimal" className="w-full pl-14 pr-8 py-5 rounded-[2rem] border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 text-2xl font-black text-right outline-none focus:border-indigo-600 transition-all shadow-xl shadow-indigo-500/10" value={strTotalWithBdi} onChange={e => handleNumericChange(setStrTotalWithBdi, e.target.value, 'totalWithBdi')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 sm:px-10 py-6 sm:py-8 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end items-stretch gap-4 shrink-0">
            <button 
              type="button"
              onClick={onClose} 
              className="py-4 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className={`py-5 px-10 text-[11px] font-black text-white ${isCategory ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-emerald-600 shadow-emerald-500/30'} rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all uppercase tracking-[0.1em]`}
            >
              <Save size={18} /> {editingItem ? 'Salvar Alterações' : 'Confirmar Inclusão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
