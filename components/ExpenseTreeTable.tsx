
import React from 'react';
import { ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { 
  ChevronRight, ChevronDown, Trash2, Edit3, Layers, 
  Calendar, Truck, CheckCircle2, Circle, GripVertical, Clock, Landmark, Tag, FileText, Download
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { expenseService } from '../services/expenseService';

interface ExpenseTreeTableProps {
  data: (ProjectExpense & { depth: number })[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (item: ProjectExpense) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, itemType: 'category' | 'item') => void;
  onUpdateTotal: (id: string, amount: number) => void;
  onUpdateUnitPrice: (id: string, price: number) => void;
  onTogglePaid: (id: string) => void;
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onMoveManual: (id: string, direction: 'up' | 'down') => void;
  isReadOnly?: boolean;
  currencySymbol?: string;
}

export const ExpenseTreeTable: React.FC<ExpenseTreeTableProps> = ({ 
  data, expandedIds, onToggle, onEdit, onDelete, onAddChild, onUpdateTotal, onUpdateUnitPrice, onTogglePaid, onReorder, onMoveManual, isReadOnly, currencySymbol = 'R$'
}) => {
  const isRevenueTable = data.some(d => d.type === 'revenue');

  const handleExportPackage = (item: ProjectExpense) => {
    const pkg = expenseService.getReleasePackage(item);
    // Aqui poderíamos disparar a geração do PDF, por enquanto vamos logar o objeto de conformidade
    console.log("Release Package Gerado:", pkg);
    alert(`Pacote de Liberação ${pkg.protocolo} gerado para ${pkg.fornecedor}.`);
  };

  return (
    <div className={`overflow-x-auto border rounded-3xl bg-white dark:bg-slate-900 shadow-xl transition-colors ${isRevenueTable ? 'border-emerald-100 dark:border-emerald-900/40' : 'border-slate-200 dark:border-slate-800'}`}>
      <DragDropContext onDragEnd={() => {}}>
        <table className="min-w-full border-collapse text-[11px]">
          <thead className={`${isRevenueTable ? 'bg-emerald-950 dark:bg-emerald-900/20' : 'bg-slate-900 dark:bg-black'} text-white sticky top-0 z-20`}>
            <tr className="uppercase tracking-widest font-black text-[9px] opacity-80">
              <th className="p-4 border-r border-white/5 w-12 text-center"></th>
              <th className="p-4 border-r border-white/5 w-20 text-center">Status</th>
              <th className="p-4 border-r border-white/5 w-28 text-center">Ações</th>
              <th className="p-4 border-r border-white/5 text-left min-w-[300px]">Descrição / Fornecedor</th>
              <th className="p-4 border-r border-white/5 w-44 text-left">Datas</th>
              <th className="p-4 border-r border-white/5 w-16 text-center">Und</th>
              <th className="p-4 border-r border-white/5 w-20 text-center">Qtd</th>
              <th className="p-4 border-r border-white/5 w-32 text-right">Unitário</th>
              <th className="p-4 w-32 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.map((item) => (
              <tr key={item.id} className={`group ${item.itemType === 'category' ? 'bg-slate-50/50 dark:bg-slate-800/20 font-bold' : ''}`}>
                <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                  <div className="p-1 text-slate-300 group-hover:text-indigo-500 transition-colors"><GripVertical size={14} /></div>
                </td>
                <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                   {item.itemType === 'item' && (
                     <div className="flex justify-center">
                        {item.status === 'DELIVERED' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center" title="Entregue">
                            <Truck size={14}/>
                          </div>
                        ) : item.status === 'PAID' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center" title="Pago">
                            <CheckCircle2 size={14}/>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center" title="Pendente">
                            <Clock size={14}/>
                          </div>
                        )}
                     </div>
                   )}
                </td>
                <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={14}/></button>
                    {item.itemType === 'item' && item.status !== 'PENDING' && (
                      <button onClick={() => handleExportPackage(item)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg" title="Gerar Liberação"><Download size={14}/></button>
                    )}
                    <button onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </td>
                <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                    {item.itemType === 'category' ? (
                      <button onClick={() => onToggle(item.id)} className="p-1 rounded-md text-slate-400">
                        {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    ) : <div className="w-6" />}
                    <div className="flex flex-col">
                       <span className={`truncate ${item.itemType === 'category' ? 'uppercase text-[10px] font-black' : 'text-slate-600 dark:text-slate-300'}`}>{item.description}</span>
                       {item.itemType === 'item' && <span className="text-[8px] font-bold text-slate-400 uppercase">{item.entityName || 'Sem Fornecedor'}</span>}
                    </div>
                  </div>
                </td>
                <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
                   {item.itemType === 'item' ? (
                     <div className="space-y-0.5">
                       <p>Lançado: {financial.formatDate(item.date)}</p>
                       {item.deliveryDate && <p className="text-emerald-600 font-bold">Entrega: {financial.formatDate(item.deliveryDate)}</p>}
                     </div>
                   ) : '—'}
                </td>
                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono">{item.itemType === 'item' ? item.quantity : '-'}</td>
                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 font-mono">
                  {financial.formatVisual(item.unitPrice, currencySymbol)}
                </td>
                <td className="p-2 text-right">
                   <span className={`font-black ${isRevenueTable ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'}`}>{financial.formatVisual(item.amount, currencySymbol)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DragDropContext>
    </div>
  );
};
