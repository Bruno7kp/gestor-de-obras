
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirmar ação',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const colors = variant === 'danger'
    ? { icon: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600', btn: 'bg-rose-600 shadow-rose-500/20 hover:bg-rose-700' }
    : { icon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600', btn: 'bg-amber-600 shadow-amber-500/20 hover:bg-amber-700' };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onCancel}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-6">
          <div className={`p-3 rounded-2xl shrink-0 ${colors.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-xl border border-slate-200 dark:border-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all ${colors.btn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
