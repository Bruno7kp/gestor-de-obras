
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType, ExpenseStatus } from '../types';
import { financial } from '../utils/math';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { X, Save, Truck, Users, Calculator, FolderTree, Calendar, Clock, Landmark, ReceiptText, ClipboardCheck, ArrowRight } from 'lucide-react';

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
    deliveryDate: undefined
  });

  const [strQty, setStrQty] = useState('1,00');
  const [strPrice, setStrPrice] = useState('0,00');
  const [strAmount, setStrAmount] = useState('0,00');

  useEffect(() => {
    if (editingItem) {
      setFormData({ ...editingItem });
      setActiveItemType(editingItem.itemType);
      setStrQty(financial.formatVisual(editingItem.quantity || 0, '').trim());
      setStrPrice(financial.formatVisual(editingItem.unitPrice || 0, '').trim());
      setStrAmount(financial.formatVisual(editingItem.amount || 0, '').trim());
    } else {
      setFormData({ 
        description: '', parentId: null, unit: isRevenue ? 'vb' : 'un', 
        quantity: 1, unitPrice: 0, amount: 0, entityName: '', 
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING'
      });
      setActiveItemType(initialItemType);
      setStrQty('1,00'); setStrPrice('0,00'); setStrAmount('0,00');
    }
  }, [editingItem, isOpen, initialItemType, expenseType]);

  const handleNumericChange = (val: string, setter: (v: string) => void, field: 'qty' | 'price') => {
    const masked = financial.maskCurrency(val);
    setter(masked);
    const q = field === 'qty' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strQty);
    const p = field === 'price' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strPrice);
    setStrAmount(financial.formatVisual(financial.round(q * p), '').trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;
    
    // Promoção automática de estado baseada em anexos
    let finalStatus: ExpenseStatus = formData.status || 'PENDING';
    if (formData.invoiceDoc) {
      finalStatus = 'DELIVERED';
    } else if (formData.paymentProof) {
      finalStatus = 'PAID';
    }

    onSave({
      ...formData,
      status: finalStatus,
      itemType: activeItemType,
      type: expenseType,
      quantity: financial.parseLocaleNumber(strQty),
      unitPrice: financial.parseLocaleNumber(strPrice),
      amount: financial.parseLocaleNumber(strAmount),
      isPaid: finalStatus === 'PAID' || finalStatus === 'DELIVERED'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        
        <div className={`px-8 py-6 border-b flex items-center justify-between shrink-0 ${isRevenue ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-indigo-50 dark:bg-indigo-900/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white ${isRevenue ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {isRevenue ? <Landmark size={24} /> : <ReceiptText size={24} />}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Novo'} Registro</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fluxo de Suprimentos & Compliance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* COLUNA DADOS: 7 SPAN */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Descrição</label>
                  <input required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Entidade / Fornecedor</label>
                    <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" value={formData.entityName} onChange={e => setFormData({...formData, entityName: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data Lançamento</label>
                    <input type="date" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800">
                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Qtd</label>
                      <input className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-center" value={strQty} onChange={e => handleNumericChange(e.target.value, setStrQty, 'qty')} />
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Unitário</label>
                      <input className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-right" value={strPrice} onChange={e => handleNumericChange(e.target.value, setStrPrice, 'price')} />
                   </div>
                   <div>
                      <label className="text-[9px] font-black text-indigo-500 uppercase mb-2 block text-center">Total</label>
                      <input readOnly className="w-full px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-xs font-black text-right text-indigo-600" value={strAmount} />
                   </div>
                </div>
              </div>

              {/* COLUNA CICLO DE VIDA: 5 SPAN */}
              <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-2">
                  <ClipboardCheck size={18} className="text-indigo-500" />
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Controle de Suprimentos</h3>
                </div>

                <ExpenseAttachmentZone 
                  label="1. Comprovante de Pagamento"
                  requiredStatus="PAID"
                  currentFile={formData.paymentProof}
                  onUpload={(base64) => setFormData({...formData, paymentProof: base64})}
                  onRemove={() => setFormData({...formData, paymentProof: undefined})}
                />

                <ExpenseAttachmentZone 
                  label="2. Nota Fiscal / Fatura"
                  requiredStatus="DELIVERED"
                  currentFile={formData.invoiceDoc}
                  onUpload={(base64) => setFormData({...formData, invoiceDoc: base64})}
                  onRemove={() => setFormData({...formData, invoiceDoc: undefined})}
                />

                {formData.status === 'DELIVERED' || formData.invoiceDoc ? (
                  <div className="animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data de Entrega na Obra</label>
                    <input 
                      type="date" 
                      className="w-full px-5 py-3 rounded-xl border-2 border-emerald-100 dark:border-emerald-900 bg-white dark:bg-slate-900 text-xs font-black outline-none" 
                      value={formData.deliveryDate || ''} 
                      onChange={e => setFormData({...formData, deliveryDate: e.target.value})} 
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Cancelar</button>
            <button type="submit" className={`px-12 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 ${isRevenue ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <Save size={18} /> Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
