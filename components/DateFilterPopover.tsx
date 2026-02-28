import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateFilterPopoverProps {
  dateStart: string;
  dateEnd: string;
  onDateStartChange: (v: string) => void;
  onDateEndChange: (v: string) => void;
}

export const DateFilterPopover: React.FC<DateFilterPopoverProps> = ({
  dateStart,
  dateEnd,
  onDateStartChange,
  onDateEndChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasFilter = !!(dateStart || dateEnd);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const setQuick = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onDateStartChange(start.toISOString().split('T')[0]);
    onDateEndChange(end.toISOString().split('T')[0]);
  };

  const clear = () => {
    onDateStartChange('');
    onDateEndChange('');
  };

  const formatLabel = () => {
    if (!dateStart && !dateEnd) return null;
    const fmt = (d: string) => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}`;
    };
    if (dateStart && dateEnd) return `${fmt(dateStart)} – ${fmt(dateEnd)}`;
    if (dateStart) return `a partir ${fmt(dateStart)}`;
    return `até ${fmt(dateEnd)}`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border shadow-sm text-[10px] font-black uppercase tracking-widest transition-all ${
          hasFilter
            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
        }`}
        title="Filtro de data"
      >
        <Calendar size={14} />
        {hasFilter && (
          <span className="hidden sm:inline text-[9px]">{formatLabel()}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtrar por período</p>
            {hasFilter && (
              <button
                onClick={clear}
                className="flex items-center gap-1 text-[9px] font-bold text-rose-500 hover:text-rose-600 transition-all"
              >
                <X size={10} /> Limpar
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Início</label>
              <input
                type="date"
                value={dateStart}
                onChange={e => onDateStartChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fim</label>
              <input
                type="date"
                value={dateEnd}
                onChange={e => onDateEndChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Últimos</span>
            {[{ days: 7, label: '7 dias' }, { days: 15, label: '15 dias' }, { days: 30, label: '30 dias' }].map(p => (
              <button
                key={p.days}
                onClick={() => setQuick(p.days)}
                className="flex-1 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-all text-center"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
