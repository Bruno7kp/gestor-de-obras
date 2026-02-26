
import React, { useState, useEffect } from 'react';
import { X, ArrowUpCircle, ArrowDownCircle, Save, User, FileText, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StockItem, StockMovementType } from '../types';
import { financial } from '../utils/math';

const MIN_QTY_DECIMALS = 2;
const MAX_QTY_DECIMALS = 6;

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (type: StockMovementType, quantity: number, responsible: string, notes: string) => void;
  item: StockItem | null;
  defaultType?: StockMovementType;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({ isOpen, onClose, onSave, item, defaultType }) => {
  const [type, setType] = useState<StockMovementType>('entry');
  const [strQty, setStrQty] = useState('0,00');
  const [qtyDecimals, setQtyDecimals] = useState(MIN_QTY_DECIMALS);
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setType(defaultType ?? 'entry');
      setStrQty(financial.maskDecimal('0', MIN_QTY_DECIMALS));
      setQtyDecimals(MIN_QTY_DECIMALS);
      setResponsible('');
      setNotes('');
    }
  }, [isOpen, defaultType]);

  // Reformat when decimal scale changes
  useEffect(() => {
    setStrQty((prev) => {
      const num = financial.parseLocaleNumber(prev);
      const raw = Math.round(num * 10 ** qtyDecimals).toString();
      return financial.maskDecimal(raw, qtyDecimals);
    });
  }, [qtyDecimals]);

  if (!isOpen || !item) return null;

  const quantity = financial.parseLocaleNumber(strQty);
  const previewBalance = type === 'exit'
    ? item.currentQuantity - quantity
    : item.currentQuantity + quantity;
  const willGoNegative = type === 'exit' && quantity > 0 && previewBalance < 0;

  const handleQtyChange = (val: string) => {
    setStrQty(financial.maskDecimal(val, qtyDecimals));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = financial.normalizeQuantityPrecision(financial.parseLocaleNumber(strQty), qtyDecimals);
    if (qty <= 0) return;
    onSave(type, qty, responsible, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${type === 'entry' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-600'}`}>
              {type === 'entry' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white truncate">
                Movimentar: {item.name}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Atual: {financial.formatQuantity(item.currentQuantity)} {item.unit}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('entry')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'entry' ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-400'}`}
            >
              <ArrowUpCircle size={14} /> Entrada
            </button>
            <button
              type="button"
              onClick={() => setType('exit')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${type === 'exit' ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-400'}`}
            >
              <ArrowDownCircle size={14} /> Saída
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quantidade ({item.unit})</label>
              <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl py-0.5 px-1">
                <button
                  type="button"
                  onClick={() => setQtyDecimals((prev) => financial.clampDecimals(prev - 1, MIN_QTY_DECIMALS, MAX_QTY_DECIMALS))}
                  className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                  title="Reduzir casas decimais"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setQtyDecimals((prev) => financial.clampDecimals(prev + 1, MIN_QTY_DECIMALS, MAX_QTY_DECIMALS))}
                  className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                  title="Aumentar casas decimais"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
            <input
              autoFocus
              required
              type="text"
              inputMode="decimal"
              value={strQty}
              onChange={(e) => handleQtyChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium"
              placeholder="0,00"
            />
          </div>

          {/* Preview balance & negative warning */}
          {quantity > 0 && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${willGoNegative ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}>
              {willGoNegative && <AlertTriangle size={14} />}
              <span>Saldo após: {financial.formatQuantity(previewBalance)} {item.unit}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Responsável</label>
            <div className="relative">
              <input
                required
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium"
                placeholder="Nome do colaborador"
              />
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Observações</label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium resize-none"
                placeholder="Motivo da movimentação..."
              />
              <FileText size={18} className="absolute left-4 top-4 text-slate-400" />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${type === 'entry' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'}`}
            >
              <Save size={16} />
              Registrar {type === 'entry' ? 'Entrada' : 'Saída'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
