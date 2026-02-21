
import React, { useState, useEffect } from 'react';
import { ProjectExpense, ItemType, ExpenseType, ExpenseStatus, Supplier } from '../types';
import { financial } from '../utils/math';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { X, Save, Truck, Users, Calculator, FolderTree, Landmark, ReceiptText, ClipboardCheck, Percent, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

const MIN_QUANTITY_DECIMALS = 2;
const MAX_QUANTITY_DECIMALS = 6;

const countDecimalPlaces = (value: number) => {
  if (!Number.isFinite(value)) return MIN_QUANTITY_DECIMALS;
  const asString = value.toString();
  const index = asString.indexOf('.');
  if (index < 0) return MIN_QUANTITY_DECIMALS;
  return asString.length - index - 1;
};

const resolveQuantityScale = (value: number) =>
  financial.clampDecimals(countDecimalPlaces(value), MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS);

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<ProjectExpense>) => void;
  editingItem: ProjectExpense | null;
  suppliers: Supplier[];
  expenseType: ExpenseType;
  itemType: ItemType;
  categories: (ProjectExpense & { depth: number })[];
  currencySymbol?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen, onClose, onSave, editingItem, suppliers, expenseType, itemType: initialItemType, categories,
  currencySymbol = 'R$'
}) => {
  const isIncome = expenseType === 'revenue' || expenseType === 'other';
  const isRevenue = expenseType === 'revenue';
  const isOther = expenseType === 'other';
  const isLabor = expenseType === 'labor';
  const [activeItemType, setActiveItemType] = useState<ItemType>(initialItemType);

  const buildDefaultFormData = () => ({
    description: '',
    parentId: null,
    unit: isIncome ? 'vb' : 'un',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    entityName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'PENDING' as ExpenseStatus,
    paymentProof: undefined,
    invoiceDoc: undefined,
    deliveryDate: undefined,
    discountValue: 0,
    discountPercentage: 0,
    issValue: 0,
    issPercentage: 0
  });

  const [formData, setFormData] = useState<Partial<ProjectExpense>>(buildDefaultFormData());

  const [strQty, setStrQty] = useState('1,00');
  const [quantityDecimals, setQuantityDecimals] = useState(MIN_QUANTITY_DECIMALS);
  const [strPrice, setStrPrice] = useState('0,00');
  const [strDiscountValue, setStrDiscountValue] = useState('0,00');
  const [strDiscountPercent, setStrDiscountPercent] = useState('0,00');
  const [strIssValue, setStrIssValue] = useState('0,00');
  const [strIssPercent, setStrIssPercent] = useState('0,00');
  const [strAmount, setStrAmount] = useState('0,00');

  useEffect(() => {
    if (editingItem) {
      const defaults = buildDefaultFormData();
      setFormData({
        ...defaults,
        ...editingItem,
        description: editingItem.description ?? defaults.description,
        entityName: editingItem.entityName ?? defaults.entityName,
        unit: editingItem.unit ?? defaults.unit,
        date: editingItem.date ?? defaults.date,
        quantity: editingItem.quantity ?? defaults.quantity,
        unitPrice: editingItem.unitPrice ?? defaults.unitPrice,
        amount: editingItem.amount ?? defaults.amount,
        status: editingItem.status ?? defaults.status,
      });
      setActiveItemType(editingItem.itemType);
      const qtyScale = resolveQuantityScale(editingItem.quantity || 0);
      setQuantityDecimals(qtyScale);
      setStrQty(financial.formatVisualPrecision(editingItem.quantity || 0, '', qtyScale, qtyScale).trim());
      setStrPrice(financial.formatVisual(editingItem.unitPrice || 0, '').trim());
      setStrDiscountValue(financial.formatVisual(editingItem.discountValue || 0, '').trim());
      setStrDiscountPercent(financial.formatVisual(editingItem.discountPercentage || 0, '').trim());
      setStrIssValue(financial.formatVisual(editingItem.issValue || 0, '').trim());
      setStrIssPercent(financial.formatVisual(editingItem.issPercentage || 0, '').trim());
      setStrAmount(financial.formatVisual(editingItem.amount || 0, '').trim());
    } else {
      setFormData(buildDefaultFormData());
      setActiveItemType(initialItemType);
      setQuantityDecimals(MIN_QUANTITY_DECIMALS);
      setStrQty('1,00'); setStrPrice('0,00'); setStrDiscountValue('0,00'); setStrDiscountPercent('0,00'); setStrIssValue('0,00'); setStrIssPercent('0,00'); setStrAmount('0,00');
    }
  }, [editingItem, isOpen, initialItemType, expenseType]);

  // Re-format quantity string when decimal precision changes
  useEffect(() => {
    const currentQty = financial.parseLocaleNumber(strQty);
    const reformatted = financial.maskDecimal(
      Math.round(currentQty * 10 ** quantityDecimals).toString(),
      quantityDecimals,
    );
    setStrQty(reformatted);
    // Recalculate amount with new quantity precision
    const q = financial.normalizeQuantityPrecision(currentQty, quantityDecimals);
    const p = financial.parseLocaleNumber(strPrice);
    const subtotal = financial.round(q * p);
    const dPct = financial.parseLocaleNumber(strDiscountPercent);
    const dVal = financial.round(subtotal * (dPct / 100));
    setStrDiscountValue(financial.formatVisual(dVal, '').trim());
    const iPct = isIncome ? financial.parseLocaleNumber(strIssPercent) : 0;
    const iVal = isIncome ? financial.round(subtotal * (iPct / 100)) : 0;
    if (isIncome) setStrIssValue(financial.formatVisual(iVal, '').trim());
    const finalAmount = Math.max(0, financial.round(subtotal - dVal - iVal));
    setStrAmount(financial.formatVisual(finalAmount, '').trim());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantityDecimals]);

  // Automação básica de status baseada em anexos (apenas para ITENS)
  useEffect(() => {
    if (activeItemType === 'item') {
      let newStatus: ExpenseStatus = formData.status || 'PENDING';
      if (formData.invoiceDoc && !isLabor && !isIncome) newStatus = 'DELIVERED';
      if (isIncome && formData.invoiceDoc) newStatus = 'DELIVERED';
      if (formData.paymentProof && newStatus === 'PENDING') newStatus = 'PAID';

      if (newStatus !== formData.status) {
        setFormData(prev => ({ ...prev, status: newStatus }));
      }
    }
  }, [formData.invoiceDoc, formData.paymentProof, activeItemType, isLabor, isIncome]);

  const handleNumericChange = (val: string, setter: (v: string) => void, field: 'qty' | 'price' | 'discountVal' | 'discountPct' | 'issVal' | 'issPct') => {
    const masked = field === 'qty' ? financial.maskDecimal(val, quantityDecimals) : financial.maskCurrency(val);
    setter(masked);

    const q = field === 'qty' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strQty);
    const p = field === 'price' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strPrice);
    let dVal = field === 'discountVal' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strDiscountValue);
    const dPct = field === 'discountPct' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strDiscountPercent);
    let iVal = field === 'issVal' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strIssValue);
    const iPct = field === 'issPct' ? financial.parseLocaleNumber(masked) : financial.parseLocaleNumber(strIssPercent);

    const subtotal = financial.round(q * p);

    // Lógica de Desconto
    if (field === 'discountPct') {
      dVal = financial.round(subtotal * (dPct / 100));
      setStrDiscountValue(financial.formatVisual(dVal, '').trim());
    }
    if (field === 'qty' || field === 'price') {
      const currentPct = financial.parseLocaleNumber(strDiscountPercent);
      dVal = financial.round(subtotal * (currentPct / 100));
      setStrDiscountValue(financial.formatVisual(dVal, '').trim());
    }
    if (field === 'discountVal' && subtotal > 0) {
      const newPct = financial.round((dVal / subtotal) * 100);
      setStrDiscountPercent(financial.formatVisual(newPct, '').trim());
    }

    // Lógica de ISS
    if (isIncome) {
      if (field === 'issPct') {
        iVal = financial.round(subtotal * (iPct / 100));
        setStrIssValue(financial.formatVisual(iVal, '').trim());
      }
      if (field === 'qty' || field === 'price') {
        const currentIssPct = financial.parseLocaleNumber(strIssPercent);
        iVal = financial.round(subtotal * (currentIssPct / 100));
        setStrIssValue(financial.formatVisual(iVal, '').trim());
      }
      if (field === 'issVal' && subtotal > 0) {
        const newIssPct = financial.round((iVal / subtotal) * 100);
        setStrIssPercent(financial.formatVisual(newIssPct, '').trim());
      }
    }

    const finalAmount = Math.max(0, financial.round(subtotal - dVal - iVal));
    setStrAmount(financial.formatVisual(finalAmount, '').trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) return;

    onSave({
      ...formData,
      itemType: activeItemType,
      type: expenseType,
      quantity: financial.normalizeQuantityPrecision(financial.parseLocaleNumber(strQty), quantityDecimals),
      unitPrice: financial.normalizeMoney(financial.parseLocaleNumber(strPrice)),
      discountValue: financial.normalizeMoney(financial.parseLocaleNumber(strDiscountValue)),
      discountPercentage: financial.normalizePercent(financial.parseLocaleNumber(strDiscountPercent)),
      issValue: isIncome ? financial.normalizeMoney(financial.parseLocaleNumber(strIssValue)) : 0,
      issPercentage: isIncome ? financial.normalizePercent(financial.parseLocaleNumber(strIssPercent)) : 0,
      amount: activeItemType === 'category' ? 0 : financial.normalizeMoney(financial.parseLocaleNumber(strAmount)),
      isPaid: formData.status === 'PAID' || formData.status === 'DELIVERED'
    });
    onClose();
  };

  if (!isOpen) return null;
  const isCategory = activeItemType === 'category';
  const isSupplyLinked =
    formData.type === 'material' &&
    formData.itemType === 'item' &&
    typeof formData.description === 'string' &&
    /^Pedido (Pendente|Pago|Entregue): /.test(formData.description);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[95vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className={`px-8 py-6 border-b flex items-center justify-between shrink-0 ${isIncome ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'bg-indigo-50 dark:bg-indigo-900/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl text-white ${isIncome ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {isCategory ? <Layers size={24} /> : (isIncome ? <Landmark size={24} /> : (isLabor ? <Users size={24} /> : <ReceiptText size={24} />))}
            </div>
            <div>
              <h2 className="text-xl font-black dark:text-white tracking-tight">{editingItem ? 'Editar' : 'Novo'} {isCategory ? 'Grupo' : 'Lançamento'}</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Controle Hierárquico Financeiro</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
            {!editingItem && (
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 max-w-sm mx-auto">
                <button type="button" onClick={() => setActiveItemType('category')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'category' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Grupo de Despesa</button>
                <button type="button" onClick={() => setActiveItemType('item')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeItemType === 'item' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Lançamento Direto</button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className={isCategory ? "lg:col-span-12" : "lg:col-span-7"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Vínculo Hierárquico</label>
                    <div className="relative">
                      <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <select
                        className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none appearance-none focus:border-indigo-500 transition-all"
                        value={formData.parentId || ''}
                        onChange={e => setFormData(prev => ({ ...prev, parentId: e.target.value || null }))}
                      >
                        <option value="">Raiz do Financeiro</option>
                        {categories.filter(c => c.id !== editingItem?.id).map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {"\u00A0".repeat(cat.depth * 2)} {cat.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!isCategory && (
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Status de Liquidação</label>
                      <select
                        className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black uppercase outline-none focus:border-indigo-500 transition-all"
                        value={formData.status}
                        onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as ExpenseStatus }))}
                        disabled={isSupplyLinked}
                      >
                        <option value="PENDING">{isRevenue ? 'Pendente' : isIncome ? 'Transferencia pendente' : 'Pendente'}</option>
                        {!isIncome && <option value="PAID">Pago / Liquidado</option>}
                        {!isLabor && <option value="DELIVERED">{isRevenue ? 'Faturado' : isIncome ? 'Transferido' : 'Entregue no Local'}</option>}
                      </select>
                      {isSupplyLinked && (
                        <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          Status controlado por suprimentos.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Descrição do Lançamento</label>
                  <input required className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Ex: Cimento CP-II 50kg" />
                </div>

                {!isCategory && (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Entidade / Fornecedor / MEI</label>
                        {suppliers.length > 0 ? (
                          <select
                            className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none appearance-none focus:border-indigo-500 transition-all"
                            value={formData.entityName || ''}
                            onChange={e => setFormData(prev => ({ ...prev, entityName: e.target.value }))}
                          >
                            <option value="">Selecione um fornecedor</option>
                            {suppliers
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                              .map((supplier) => (
                                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
                              ))}
                          </select>
                        ) : (
                          <input className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.entityName} onChange={e => setFormData(prev => ({ ...prev, entityName: e.target.value }))} placeholder="Nome Fantasia ou Razão" />
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">Mês de Competência</label>
                        <input type="date" className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all" value={formData.date} onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))} />
                      </div>
                    </div>

                    <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-6">
                      <div className={`grid ${isOther ? 'grid-cols-1' : 'grid-cols-3'} gap-6`}>
                        {!isOther && (
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">Unidade</label>
                            <input className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-center uppercase outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.unit} onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))} />
                          </div>
                        )}
                        {!isOther && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</label>
                              <div className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg py-0.5 px-0.5">
                                <button
                                  type="button"
                                  onClick={() => setQuantityDecimals((prev) => financial.clampDecimals(prev - 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                                  className="px-1.5 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                                  title="Reduzir casas decimais"
                                >
                                  <ChevronLeft size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQuantityDecimals((prev) => financial.clampDecimals(prev + 1, MIN_QUANTITY_DECIMALS, MAX_QUANTITY_DECIMALS))}
                                  className="px-1.5 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-200 rounded-md hover:bg-white dark:hover:bg-slate-700"
                                  title="Aumentar casas decimais"
                                >
                                  <ChevronRight size={10} />
                                </button>
                              </div>
                            </div>
                            <input inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500/20" value={strQty} onChange={e => handleNumericChange(e.target.value, setStrQty, 'qty')} />
                          </div>
                        )}
                        <div>
                          <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block text-center">{isOther ? 'Valor' : 'Preço Unitário'}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300">R$</span>
                            <input inputMode="decimal" className="w-full pl-8 pr-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500/20" value={strPrice} onChange={e => handleNumericChange(e.target.value, setStrPrice, 'price')} />
                          </div>
                        </div>
                      </div>

                      <div className={`grid ${isIncome ? 'grid-cols-2' : 'grid-cols-2'} gap-6 pt-4 border-t border-slate-200 dark:border-slate-700`}>
                        <div className="col-span-2 grid grid-cols-2 gap-6">
                          <div>
                            <label className="text-[9px] font-black text-rose-500 uppercase mb-2 block text-center">Desconto (%)</label>
                            <input inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 text-xs font-black text-right text-rose-600 outline-none" value={strDiscountPercent} onChange={e => handleNumericChange(e.target.value, setStrDiscountPercent, 'discountPct')} />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-rose-500 uppercase mb-2 block text-center">Desconto (R$)</label>
                            <input inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 text-xs font-black text-right text-rose-600 outline-none" value={strDiscountValue} onChange={e => handleNumericChange(e.target.value, setStrDiscountValue, 'discountVal')} />
                          </div>
                        </div>

                        {isIncome && (
                          <div className="col-span-2 grid grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <label className="text-[9px] font-black text-rose-600 uppercase mb-2 block text-center">Imposto (%)</label>
                              <input inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 text-xs font-black text-right text-rose-600 outline-none" value={strIssPercent} onChange={e => handleNumericChange(e.target.value, setStrIssPercent, 'issPct')} />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-rose-600 uppercase mb-2 block text-center">Imposto (R$)</label>
                              <input inputMode="decimal" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900 text-xs font-black text-right text-rose-600 outline-none" value={strIssValue} onChange={e => handleNumericChange(e.target.value, setStrIssValue, 'issVal')} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
                        <label className="text-[10px] font-black text-indigo-500 uppercase mb-2 block text-center tracking-widest">Valor Total Líquido</label>
                        <div className="relative">
                          <Calculator className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={20} />
                          <input readOnly className="w-full pl-12 pr-6 py-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-100 dark:border-indigo-800 text-xl font-black text-right text-indigo-600 outline-none shadow-inner" value={strAmount} />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!isCategory && (
                <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/60 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-8">
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3 mb-2">
                    <ClipboardCheck size={18} className="text-indigo-500" />
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Auditoria e Anexos</h3>
                  </div>

                  {!isIncome && (
                    <ExpenseAttachmentZone
                      label={isLabor ? "Recibo de Pagamento (Pix/DOC)" : "Comprovante de Pagamento"}
                      requiredStatus="PAID"
                      currentFile={formData.paymentProof}
                      onUploadUrl={(url) => setFormData(prev => ({ ...prev, paymentProof: url }))}
                      onRemove={() => setFormData(prev => ({ ...prev, paymentProof: undefined }))}
                    />
                  )}

                  {!isLabor && (
                    <ExpenseAttachmentZone
                      label={isIncome ? "Nota Fiscal de Faturamento" : "Nota Fiscal de Compra"}
                      requiredStatus="DELIVERED"
                      requiredStatusLabel={isRevenue ? 'Faturado' : isIncome ? 'Transferido' : undefined}
                      currentFile={formData.invoiceDoc}
                      onUploadUrl={(url) => setFormData(prev => ({ ...prev, invoiceDoc: url }))}
                      onRemove={() => setFormData(prev => ({ ...prev, invoiceDoc: undefined }))}
                    />
                  )}

                  <div className="animate-in slide-in-from-top-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest ml-1">
                      {isLabor ? 'Data da Transferência' : (isIncome ? 'Data do Faturamento' : 'Data da Entrega')}
                    </label>
                    <input
                      type="date"
                      className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black outline-none focus:border-indigo-500 transition-all shadow-sm"
                      value={formData.deliveryDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, deliveryDate: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4 shrink-0">
            <button type="button" onClick={onClose} className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-700 transition-colors">Cancelar</button>
            <button type="submit" className={`px-12 py-4 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-3 ${isIncome ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}`}>
              <Save size={18} /> {editingItem ? 'Atualizar Registro' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
