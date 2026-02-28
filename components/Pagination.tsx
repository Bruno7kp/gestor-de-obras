import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  label?: string;
}

/**
 * Reusable numbered pagination component.
 * Shows: < Anterior  1 2 ... 5 6 7 ... 12  Próximo >
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  label,
}) => {
  if (totalPages <= 1) return null;

  const getVisiblePages = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    // Always show first
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    // Window around current
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    // Always show last
    pages.push(totalPages);
    return pages;
  };

  const pages = getVisiblePages();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      {/* Info */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label && <span>{label} — </span>}
        Página {currentPage} de {totalPages}
        {totalItems != null && <span> ({totalItems} itens)</span>}
      </div>
      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        >
          <ChevronLeft size={12} /> Anterior
        </button>
        {pages.map((p, idx) =>
          p === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 py-1.5 text-[10px] font-bold text-slate-400"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[28px] px-2 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                p === currentPage
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
        >
          Próximo <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
};
