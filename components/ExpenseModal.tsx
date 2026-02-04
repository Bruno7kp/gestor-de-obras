
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType, ExpenseStatus } from '../types';
import { financial } from '../utils/math';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { X, Save, Truck, Users, Calculator, FolderTree, Calendar, Clock, Landmark, ReceiptText, ClipboardCheck, ArrowRight, Percent, Layers, Package } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProjectExpense>) => void;
  editingItem: ProjectExpense | null;
  expenseType: ExpenseType;
  itemType: ItemType;
  categories: (ProjectExpense & { depth: number })[];
  currencySymbol?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen, onClose, onSave, editingItem, expenseType, itemType: initialItemType, categories,
  currencySymbol = 'R$'
}) => {
  const isRevenue = expenseType === 'revenue';
  const [activeItemType, setActiveItemType] = useState<ItemType>(initialItemType);

  const [formData, setFormData] = useState<Partial<ProjectExpense>>({
    description: '', parentId: null, unit: 'un', quantity: 1, unitPrice: 0, amount: 0, entityName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'PENDING',
    paymentProof: undefined,
    invoiceDoc: undefined,
    deliveryDate: undefined,
    discountValue: 0,
    discountPercentage: 0
  });

  const [strQty, setStrQty] = useState('1,00');
  const [strPrice, setStrPrice] = useState('0,00');
  const [strDiscountValue, setStrDiscountValue] = useState('0,00');
  const [strDiscountPercent, setStrDiscountPercent] = useState('0,00');
  const [strAmount, setStrAmount] = useState('0,00');

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem });
      setActiveItemType(editingItem.itemType);
      setStrQty(financial.formatVisual(editingItem.quantity || 0, '').trim());
      setStrPrice(financial.formatVisual(editingItem.unitPrice || 0, '').trim());
      setStrDiscountValue(financial.formatVisual(editingItem.discountValue || 0, '').trim());
      setStrDiscountPercent(financial.formatVisual(editingItem.discountPercentage || 0, '').trim());
      setStrAmount(financial.formatVisual(editingItem.amount || 0, '').trim());
    } else {
      setFormData({
        description: '', parentId: null, unit: isRevenue ? 'vb' : 'un',
        quantity: 1, unitPrice: 0, amount: 0, entityName: '',
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        discountValue: 0,
        discountPercentage: 0
      });
      setActiveItemType(initialItemType);
      setStrQty('1,00'); setStrPrice('0,00'); setStrDiscountValue('0,00'); setStrDiscountPercent('0,00'); setStrAmount('0,00');
    }
  }, [editingItem, isOpen, initialItemType, expenseType]);

  const handleNumericChange = (val: string, setter: (v: string) => void, field: 'qty' | 'price' | 'discountVal' | 'discountPct') => {
    const masked = financial.maskCurrency(val);
    setter(masked);

    const q = field === 'qty' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strQty);
    const p = field === 'price' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strPrice);
    let dVal = field === 'discountVal' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strDiscountValue);
    const dPct = field === 'discountPct' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strDiscountPercent);

    const subtotal = financial.round(q * p);

    if (field === 'discountPct') {
      dVal = financial.round(subtotal * (dPct / 100));
      setStrDiscountValue(financial.formatVisual(dVal, '').trim());
    }

    if (field === 'qty' || field === 'price') {
      const currentPct = financial.parseLocaleNumber(strDiscountPercent);
      dVal = financial.round(subtotal * (currentPct / 100));
      setStrDiscountValue(financial.formatVisual(dVal, '').trim());
    }

    const finalAmount = Math.max(0, financial.round(subtotal - dVal));
    setStrAmount(financial.formatVisual(finalAmount, '').trim());

    if (field === 'discountVal' && subtotal > 0) {
      const newPct = financial.round((dVal / subtotal) * 100);
      setStrDiscountPercent(financial.formatVisual(newPct, '').trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;

    const qtyNum = financial.parseLocaleNumber(strQty);
    const priceNum = financial.parseLocaleNumber(strPrice);
    const amountNum = financial.parseLocaleNumber(strAmount);

    onSave({
      ...formData,
      itemType: activeItemType,
      type: expenseType,
      quantity: qtyNum,
      unitPrice: priceNum,
      discountValue: financial.parseLocaleNumber(strDiscountValue),
      discountPercentage: financial.parseLocaleNumber(strDiscountPercent),
      amount: activeItemType === 'category' ? 0 : amountNum,
      isPaid: formData.status === 'PAID' || formData.status === 'DELIVERED'
    });
    onClose();
  };

  if (!isOpen) return null;
  const isCategory = activeItemType === 'category';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className={`px-8 py-6 border-b flex items-center justify-between shrink-0 ${isRevenue ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-indigo-50 dark:bg-indigo-900/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white ${isRevenue ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {isCategory ? <Layers size={24} /> : (isRevenue ? <Landmark size={24} /> : <ReceiptText size={24} />)}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Novo'} {isCategory ? 'Grupo' : 'Lançamento'}</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gestão Financeira & Hierarquia</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">

            {!editingItem && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl gap-2 max-w-sm mx-auto">
                <button type="button" onClick={() => setActiveItemType('category')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeItemType === 'category' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Grupo Pai</button>
                <button type="button" onClick={() => setActiveItemType('item')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeItemType === 'item' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Lançamento</button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Pertence ao Grupo</label>
                    <div className="relative">
                      <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <select
                        className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none appearance-none focus:border-indigo-500"
                        value={formData.parentId || ''}
                        onChange={e => setFormData({ ...formData, parentId: e.target.value || null })}
                      >
                        <option value="">Raiz (Nenhum)</option>
                        {categories.filter(c => c.id !== editingItem?.id).map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {"\u00A0".repeat(cat.depth * 2)} {cat.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Status Manual</label>
                    <select
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black uppercase outline-none focus:border-indigo-500"
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as ExpenseStatus })}
                    >
                      <option value="PENDING">Pendente</option>
                      <option value="PAID">Pago / Liquidado</option>
                      <option value="DELIVERED">Entregue / Concluído</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Descrição</label>
                  <input required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Ex: Cimento CP-II 50kg" />
                </div>

                {!isCategory && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Entidade / Fornecedor</label>
                        <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" value={formData.entityName} onChange={e => setFormData({ ...formData, entityName: e.target.value })} placeholder="Razão Social" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data Competência</label>
                        <input type="date" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Unidade</label>
                          <input className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-center uppercase outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="Ex: m2" />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Qtd</label>
                          <input className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500/20" value={strQty} onChange={e => handleNumericChange(e.target.value, setStrQty, 'qty')} />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Preço Unitário</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">R$</span>
                            <input className="w-full pl-8 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20" value={strPrice} onChange={e => handleNumericChange(e.target.value, setStrPrice, 'price')} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <label className="text-[9px] font-black text-rose-500 uppercase mb-2 block text-center">Desconto (%)</label>
                          <div className="relative">
                            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-300" size={14} />
                            <input className="w-full pl-8 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 text-xs font-black text-right text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20" value={strDiscountPercent} onChange={e => handleNumericChange(e.target.value, setStrDiscountPercent, 'discountPct')} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-rose-500 uppercase mb-2 block text-center">Desconto (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-300">R$</span>
                            <input className="w-full pl-8 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 text-xs font-black text-right text-rose-600 outline-none focus:ring-2 focus:ring-rose-500/20" value={strDiscountValue} onChange={e => handleNumericChange(e.target.value, setStrDiscountValue, 'discountVal')} />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                        <label className="text-[9px] font-black text-indigo-500 uppercase mb-2 block text-center tracking-widest">Total Líquido</label>
                        <div className="relative">
                          <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
                          <input readOnly className="w-full pl-12 pr-6 py-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-xl font-black text-right text-indigo-600 outline-none" value={strAmount} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-2">
                  <ClipboardCheck size={18} className="text-indigo-500" />
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Compliance (Opcional)</h3>
                </div>

                <ExpenseAttachmentZone
                  label="1. Comprovante de Pagamento"
                  requiredStatus="PAID"
                  currentFile={formData.paymentProof}
                  onUpload={(base64) => setFormData({ ...formData, paymentProof: base64 })}
                  onRemove={() => setFormData({ ...formData, paymentProof: undefined })}
                />

                <ExpenseAttachmentZone
                  label="2. Nota Fiscal / Fatura"
                  requiredStatus="DELIVERED"
                  currentFile={formData.invoiceDoc}
                  onUpload={(base64) => setFormData({ ...formData, invoiceDoc: base64 })}
                  onRemove={() => setFormData({ ...formData, invoiceDoc: undefined })}
                />

                {!isCategory && (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data de Entrega</label>
                    <input
                      type="date"
                      className="w-full px-5 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black outline-none"
                      value={formData.deliveryDate || ''}
                      onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
            <button type="submit" className={`px-12 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 ${isRevenue ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <Save size={18} /> {editingItem ? 'Salvar Alterações' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
