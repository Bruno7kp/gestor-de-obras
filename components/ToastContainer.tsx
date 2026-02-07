import React from 'react';
import { Check, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToastContext, type ToastType } from '../context/ToastContext';

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success':
      return 'bg-emerald-600';
    case 'error':
      return 'bg-rose-600';
    case 'warning':
      return 'bg-amber-600';
    case 'info':
    default:
      return 'bg-blue-600';
  }
};

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <Check size={18} />;
    case 'error':
      return <AlertCircle size={18} />;
    case 'warning':
      return <AlertTriangle size={18} />;
    case 'info':
    default:
      return <Info size={18} />;
  }
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastContext();

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-[10000] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} text-white rounded-2xl p-4 shadow-lg flex items-center gap-3 min-w-80 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto`}
        >
          {getToastIcon(toast.type)}
          <span className="text-sm font-black flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Fechar notificação"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
