
import React from 'react';
import { ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit3, 
  Package, 
  Layers, 
  FolderPlus,
  FilePlus,
  Calendar,
  Truck
} from 'lucide-react';

interface ExpenseTreeTableProps {
  data: (ProjectExpense & { depth: number })[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: ProjectExpense) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, itemType: 'category' | 'item') => void;
  isReadOnly?: boolean;
}

export const ExpenseTreeTable: React.FC<ExpenseTreeTableProps> = ({ 
  data, expandedIds, onToggle, onEdit, onDelete, onAddChild, isReadOnly 
}) => {
  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-xl">
      <table className="min-w-full border-collapse text-[11px]">
        <thead className="bg-slate-900 text-white sticky top-0 z-20">
          <tr className="uppercase tracking-widest font-black text-[9px] opacity-80">
            <th className="p-4 border-r border-slate-800 w-24 text-center">Ações</th>
            <th className="p-4 border-r border-slate-800 w-20 text-center">WBS</th>
            <th className="p-4 border-r border-slate-800 text-left min-w-[300px]">Descrição do Gasto / Categoria</th>
            <th className="p-4 border-r border-slate-800 w-32 text-center">Data</th>
            <th className="p-4 border-r border-slate-800 w-48 text-left">Entidade / Fornecedor</th>
            <th className="p-4 border-r border-slate-800 w-16 text-center">Und</th>
            <th className="p-4 border-r border-slate-800 w-20 text-center">Qtd</th>
            <th className="p-4 border-r border-slate-800 w-32 text-right">Unitário</th>
            <th className="p-4 w-32 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((item) => (
            <tr key={item.id} className={`group transition-all ${item.itemType === 'category' ? 'bg-slate-50/80 dark:bg-slate-800/30 font-bold' : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/5'}`}>
              <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button disabled={isReadOnly} onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={14}/></button>
                  <button disabled={isReadOnly} onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 rounded-lg"><Trash2 size={14}/></button>
                </div>
              </td>
              <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400">{item.wbs}</td>
              <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                  {item.itemType === 'category' ? (
                    <button onClick={() => onToggle(item.id)} className={`p-1 rounded-md ${expandedIds.has(item.id) ? 'text-indigo-600 bg-indigo-100' : 'text-slate-400 bg-slate-100'}`}>
                      {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : <div className="w-6 h-px bg-slate-200" />}
                  {item.itemType === 'category' ? <Layers size={14} className="text-indigo-500" /> : <Truck size={14} className="text-slate-300" />}
                  <span className={`truncate ${item.itemType === 'category' ? 'uppercase text-[10px] font-black' : 'text-slate-600 dark:text-slate-300'}`}>{item.description}</span>
                  {item.itemType === 'category' && !isReadOnly && (
                    <div className="ml-auto lg:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      <button onClick={() => onAddChild(item.id, 'category')} className="p-1 text-slate-400 hover:text-indigo-600" title="Add Subcategoria"><FolderPlus size={14} /></button>
                      <button onClick={() => onAddChild(item.id, 'item')} className="p-1 text-slate-400 hover:text-emerald-600" title="Add Gasto"><FilePlus size={14} /></button>
                    </div>
                  )}
                </div>
              </td>
              <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 text-slate-400">
                {item.itemType === 'item' ? <div className="flex items-center justify-center gap-1"><Calendar size={10}/> {new Date(item.date).toLocaleDateString('pt-BR')}</div> : '-'}
              </td>
              <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-slate-500 truncate">
                {item.itemType === 'item' ? (item.entityName || '—') : '—'}
              </td>
              <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
              <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono">{item.itemType === 'item' ? item.quantity : '-'}</td>
              <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 font-mono">{item.itemType === 'item' ? financial.formatBRL(item.unitPrice) : '-'}</td>
              <td className="p-2 text-right font-black text-slate-800 dark:text-slate-200">{financial.formatBRL(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
