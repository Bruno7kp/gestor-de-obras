
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType } from '../types';
import { financial } from '../utils/math';
import { X, Save, Layers, Truck, Users, Calculator, ArrowRightLeft, FolderTree, Calendar, Clock, Landmark, ReceiptText, Tag, Percent } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProjectExpense>) => void;
  editingItem: ProjectExpense | null;
  expenseType: ExpenseType;
  itemType: ItemType;
  categories: (ProjectExpense & { depth: number })[];
  // Fix: Added missing currencySymbol prop definition
  currencySymbol?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen, onClose, onSave, editingItem, expenseType, itemType: initialItemType, categories,
  // Fix: Destructure currencySymbol with default value
  currencySymbol = 'R$'
}) => {
  const isRevenue = expenseType === 'revenue';
  const [activeItemType, setActiveItemType] = useState<ItemType>(initialItemType);
  
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState<Partial<ProjectExpense>>({
    description: '', parentId: null, unit: 'un', quantity: 1, unitPrice: 0, amount: 0, entityName: '', 
    date: getTodayStr(),
    paymentDate: '',
    discountValue: 0,
    discountPercentage: 0
  });

  const [strQty, setStrQty] = useState('1,00');
  const [strPrice, setStrPrice] = useState('0,00');
  const [strAmount, setStrAmount] = useState('0,00');
  const [strDiscVal, setStrDiscVal] = useState('0,00');
  const [strDiscPct, setStrDiscPct] = useState('0,00');

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem, paymentDate: editingItem.paymentDate || '' });
      setActiveItemType(editingItem.itemType);
      // Fix: Use currencySymbol for formatting and strip it to match maskCurrency expectations
      setStrQty(financial.formatVisual(editingItem.quantity || 0, currencySymbol).replace(currencySymbol, '').trim());
      setStrPrice(financial.formatVisual(editingItem.unitPrice || 0, currencySymbol).replace(currencySymbol, '').trim());
      setStrAmount(financial.formatVisual(editingItem.amount || 0, currencySymbol).replace(currencySymbol, '').trim());
      setStrDiscVal(financial.formatVisual(editingItem.discountValue || 0, currencySymbol).replace(currencySymbol, '').trim());
      setStrDiscPct(financial.formatVisual(editingItem.discountPercentage || 0, '').trim());
    } else {
      setFormData({ 
        description: '', parentId: null, 
        unit: isRevenue ? 'vb' : (expenseType === 'labor' ? 'h' : 'un'), 
        quantity: 1, unitPrice: 0, amount: 0, entityName: '', 
        date: getTodayStr(),
        paymentDate: '',
        discountValue: 0,
        discountPercentage: 0
      });
      setActiveItemType(initialItemType);
      setStrQty('1,00'); setStrPrice('0,00'); setStrAmount('0,00');
      setStrDiscVal('0,00'); setStrDiscPct('0,00');
    }
  }, [editingItem, initialItemType, isOpen, expenseType, isRevenue, currencySymbol]);

  const handleNumericChange = (setter: (v: string) => void, val: string, field: 'qty' | 'price' | 'amount' | 'discVal' | 'discPct') => {
    const masked = financial.maskCurrency(val);
    setter(masked);

    const num = financial.parseLocaleNumber(masked);
    const q = field === 'qty' ? num : financial.parseLocaleNumber(strQty);
    const p = field === 'price' ? num : financial.parseLocaleNumber(strPrice);
    const dv = field === 'discVal' ? num : financial.parseLocaleNumber(strDiscVal);
    const dp = field === 'discPct' ? num : financial.parseLocaleNumber(strDiscPct);
    
    const baseTotal = financial.round(q * p);

    if (field === 'qty' || field === 'price') {
      const actualDisc = financial.round(baseTotal * (dp / 100));
      // Fix: Use currencySymbol for consistency and strip it for internal state
      setStrDiscVal(financial.formatVisual(actualDisc, currencySymbol).replace(currencySymbol, '').trim());
      setStrAmount(financial.formatVisual(financial.round(baseTotal - actualDisc), currencySymbol).replace(currencySymbol, '').trim());
    } 
    else if (field === 'discVal') {
      const newPct = baseTotal > 0 ? financial.round((num / baseTotal) * 100) : 0;
      setStrDiscPct(financial.formatVisual(newPct, '').trim());
      setStrAmount(financial.formatVisual(financial.round(baseTotal - num), currencySymbol).replace(currencySymbol, '').trim());
    }
    else if (field === 'discPct') {
      const newVal = financial.round(baseTotal * (num / 100));
      setStrDiscVal(financial.formatVisual(newVal, currencySymbol).replace(currencySymbol, '').trim());
      setStrAmount(financial.formatVisual(financial.round(baseTotal - newVal), currencySymbol).replace(currencySymbol, '').trim());
    }
    else if (field === 'amount') {
      const newDisc = financial.round(baseTotal - num);
      setStrDiscVal(financial.formatVisual(newDisc, currencySymbol).replace(currencySymbol, '').trim());
      const newPct = baseTotal > 0 ? financial.round((newDisc / baseTotal) * 100) : 0;
      setStrDiscPct(financial.formatVisual(newPct, '').trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;
    onSave({
      ...formData,
      itemType: activeItemType,
      type: expenseType,
      quantity: financial.parseLocaleNumber(strQty),
      unitPrice: financial.parseLocaleNumber(strPrice),
      discountValue: financial.parseLocaleNumber(strDiscVal),
      discountPercentage: financial.parseLocaleNumber(strDiscPct),
      amount: financial.parseLocaleNumber(strAmount),
      paymentDate: formData.paymentDate || undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        <div className={`px-8 py-6 border-b flex items-center justify-between shrink-0 ${isRevenue ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800' : 'bg-indigo-50/50 dark:border-indigo-800'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white shadow-lg ${isRevenue ? 'bg-emerald-600 shadow-emerald-500/20' : (expenseType === 'labor' ? 'bg-blue-600' : 'bg-indigo-600')}`}>
              {isRevenue ? <Landmark size={24} /> : (expenseType === 'labor' ? <Users size={24} /> : <Truck size={24} />)}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight leading-tight">
                {editingItem ? 'Editar' : 'Novo'} {isRevenue ? 'Lançamento de Receita' : (expenseType === 'labor' ? 'Gasto de Mão de Obra' : 'Insumo / Despesa')}
              </h2>
              <p className={`text-[9px] font-bold uppercase tracking-widest ${isRevenue ? 'text-emerald-600' : 'text-slate-500'}`}>
                {isRevenue ? 'Fluxo de Entrada de Caixa' : 'Gestão de Custos Diretos'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {!editingItem && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2">
                <button type="button" onClick={() => setActiveItemType('category')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'category' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Grupo / Pasta</button>
                <button type="button" onClick={() => setActiveItemType('item')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'item' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>{isRevenue ? 'Receita Unitária' : 'Insumo / Gasto'}</button>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Vincular ao Grupo Financeiro</label>
                <div className="relative">
                  <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <select className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-500 transition-all" value={formData.parentId || ''} onChange={e => setFormData({...formData, parentId: e.target.value || null})}>
                    <option value="">Nível Principal</option>
                    {categories.filter(c => c.id !== editingItem?.id).map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {"\u00A0".repeat(cat.depth * 3)} {cat.wbs} - {cat.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">{isRevenue ? 'Descrição da Receita / Fatura' : 'Nome do Insumo / Descrição do Gasto'}</label>
                <div className="relative">
                   {isRevenue ? <ReceiptText className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={16} /> : null}
                   <input className={`w-full ${isRevenue ? 'pl-12' : 'px-6'} py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-sm font-black outline-none focus:border-indigo-500 transition-all`} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder={isRevenue ? "Ex: Medição #04 - Cliente X" : "Ex: Cimento CP-II 50kg"} />
                </div>
              </div>

              {activeItemType === 'item' && (
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2 grid grid-cols-2 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">{isRevenue ? 'Data de Emissão' : 'Data da Compra'}</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="date" className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-emerald-600 uppercase mb-2 block tracking-widest">{isRevenue ? 'Previsão / Data Crédito' : 'Data do Pagamento'}</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                        <input type="date" className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/20 bg-emerald-50/20 dark:bg-emerald-950/20 dark:text-white text-xs font-bold outline-none focus:border-emerald-500 transition-all" value={formData.paymentDate || ''} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">{isRevenue ? 'Cliente / Fonte Pagadora' : 'Fornecedor / Profissional'}</label>
                    <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all" value={formData.entityName} onChange={e => setFormData({...formData, entityName: e.target.value})} />
                  </div>
                  
                  <div className="grid grid-cols-3 col-span-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Und</label>
                      <input className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold text-center outline-none focus:border-indigo-500 transition-all" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Qtd</label>
                      <input type="text" inputMode="decimal" className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold text-center outline-none focus:border-indigo-500 transition-all" value={strQty} onChange={e => handleNumericChange(setStrQty, e.target.value, 'qty')} />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">Unitário</label>
                      <input type="text" inputMode="decimal" className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 dark:text-white text-xs font-bold text-right outline-none focus:border-indigo-500 transition-all" value={strPrice} onChange={e => handleNumericChange(setStrPrice, e.target.value, 'price')} />
                    </div>
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-4 p-5 bg-slate-100/50 dark:bg-slate-800/30 rounded-3xl border border-slate-200 dark:border-slate-700">
                    <div className="col-span-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-2">
                       <Tag size={12}/> Descontos / Abatimentos
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block tracking-widest">Desconto Valor</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{currencySymbol}</span>
                        <input type="text" inputMode="decimal" className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-right outline-none focus:border-rose-500 transition-all" value={strDiscVal} onChange={e => handleNumericChange(setStrDiscVal, e.target.value, 'discVal')} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block tracking-widest">Desconto %</label>
                      <div className="relative">
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <input type="text" inputMode="decimal" className="w-full pl-4 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold text-right outline-none focus:border-rose-500 transition-all" value={strDiscPct} onChange={e => handleNumericChange(setStrDiscPct, e.target.value, 'discPct')} />
                      </div>
                    </div>
                  </div>

                  <div className={`col-span-2 p-6 rounded-[2rem] border-2 border-dashed ${isRevenue ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800'}`}>
                    <label className={`text-[10px] font-black uppercase mb-2 block tracking-widest text-center ${isRevenue ? 'text-emerald-600' : 'text-indigo-600'}`}>{isRevenue ? 'Valor Total a Receber (Líquido)' : 'Valor Total Líquido Liquidado'}</label>
                    <div className="relative">
                      <Calculator className={`absolute left-5 top-1/2 -translate-y-1/2 ${isRevenue ? 'text-emerald-400' : 'text-indigo-400'}`} size={20} />
                      <input type="text" inputMode="decimal" className={`w-full pl-14 pr-6 py-4 rounded-2xl border-2 bg-white dark:bg-slate-950 text-2xl font-black text-right outline-none transition-all ${isRevenue ? 'border-emerald-100 focus:border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-indigo-100 focus:border-indigo-600 text-indigo-700 dark:text-indigo-300'}`} value={strAmount} onChange={e => handleNumericChange(setStrAmount, e.target.value, 'amount')} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors">Cancelar</button>
            <button type="submit" className={`px-12 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 ${isRevenue ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
              <Save size={18} /> {editingItem ? 'Salvar Alterações' : (isRevenue ? 'Efetivar Receita' : 'Salvar Gasto')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
