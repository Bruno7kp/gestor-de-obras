
import React, { useState, useEffect } from 'react';
import { X, Package, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StockItem } from '../types';
import { financial } from '../utils/math';

const MIN_QTY_DECIMALS = 2;
const MAX_QTY_DECIMALS = 6;

interface StockItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; unit: string; minQuantity: number }) => void;
  editingItem: StockItem | null;
}

export const StockItemModal: React.FC<StockItemModalProps> = ({ isOpen, onClose, onSave, editingItem }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('un');
  const [strMinQty, setStrMinQty] = useState('0,00');
  const [minQtyDecimals, setMinQtyDecimals] = useState(MIN_QTY_DECIMALS);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setUnit(editingItem.unit);
      const scale = financial.clampDecimals(
        editingItem.minQuantity.toString().split('.')[1]?.length ?? MIN_QTY_DECIMALS,
        MIN_QTY_DECIMALS,
        MAX_QTY_DECIMALS,
      );
      setMinQtyDecimals(scale);
      setStrMinQty(financial.maskDecimal(String(Math.round(editingItem.minQuantity * 10 ** scale)), scale));
    } else {
      setName('');
      setUnit('un');
      setStrMinQty(financial.maskDecimal('0', MIN_QTY_DECIMALS));
      setMinQtyDecimals(MIN_QTY_DECIMALS);
    }
  }, [editingItem, isOpen]);

  // Reformat when decimal scale changes
  useEffect(() => {
    setStrMinQty((prev) => {
      const num = financial.parseLocaleNumber(prev);
      const raw = Math.round(num * 10 ** minQtyDecimals).toString();
      return financial.maskDecimal(raw, minQtyDecimals);
    });
  }, [minQtyDecimals]);

  if (!isOpen) return null;

  const handleMinQtyChange = (val: string) => {
    const masked = financial.maskDecimal(val, minQtyDecimals);
    setStrMinQty(masked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const minQuantity = financial.normalizeQuantityPrecision(financial.parseLocaleNumber(strMinQty), minQtyDecimals);
    onSave({ name, unit, minQuantity });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
              <Package size={20} />
            </div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
              {editingItem ? 'Editar Material' : 'Novo Material'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Nome do Material</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium"
              placeholder="Ex: Cimento CP-II"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1">Unidade</label>
              <input
                required
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium text-center"
                placeholder="Ex: un, kg, m³"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque Mínimo</label>
                <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl py-0.5 px-1">
                  <button
                    type="button"
                    onClick={() => setMinQtyDecimals((prev) => financial.clampDecimals(prev - 1, MIN_QTY_DECIMALS, MAX_QTY_DECIMALS))}
                    className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                    title="Reduzir casas decimais"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMinQtyDecimals((prev) => financial.clampDecimals(prev + 1, MIN_QTY_DECIMALS, MAX_QTY_DECIMALS))}
                    className="px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-700"
                    title="Aumentar casas decimais"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={strMinQty}
                onChange={(e) => handleMinQtyChange(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none transition-all text-sm font-medium text-center"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Save size={16} />
              Salvar Material
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
