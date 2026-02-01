
import React from 'react';
import { ProjectExpense } from '../types';
import { financial } from '../utils/math';
import { 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit3, 
  Layers, 
  FolderPlus,
  FilePlus,
  Calendar,
  Truck,
  CheckCircle2,
  Circle,
  ArrowRightLeft,
  Users,
  GripVertical,
  Clock,
  Landmark,
  ChevronUp,
  Tag
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

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
}

export const ExpenseTreeTable: React.FC<ExpenseTreeTableProps> = ({ 
  data, expandedIds, onToggle, onEdit, onDelete, onAddChild, onUpdateTotal, onUpdateUnitPrice, onTogglePaid, onReorder, onMoveManual, isReadOnly 
}) => {
  const isRevenueTable = data.some(d => d.type === 'revenue');

  const handleDragEnd = (result: DropResult) => {
    if (isReadOnly) return;
    const sourceId = result.draggableId;

    if (result.combine) {
      const targetId = result.combine.draggableId;
      const targetItem = data.find(d => d.id === targetId);
      if (targetItem && targetItem.itemType === 'category') {
        onReorder(sourceId, targetId, 'inside');
      }
      return;
    }

    if (!result.destination) return;
    const targetIdx = result.destination.index;
    const targetItem = data[targetIdx];
    if (!targetItem) return;
    onReorder(sourceId, targetItem.id, 'after');
  };

  const totalTable = financial.sum(data.filter(i => i.depth === 0).map(i => i.amount));

  return (
    <div className={`overflow-x-auto border rounded-3xl bg-white dark:bg-slate-900 shadow-xl transition-colors ${isRevenueTable ? 'border-emerald-100 dark:border-emerald-900/40' : 'border-slate-200 dark:border-slate-800'}`}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <table className="min-w-full border-collapse text-[11px]">
          <thead className={`${isRevenueTable ? 'bg-emerald-950 dark:bg-emerald-900/20' : 'bg-slate-900 dark:bg-black'} text-white sticky top-0 z-20`}>
            <tr className="uppercase tracking-widest font-black text-[9px] opacity-80">
              <th className="p-4 border-r border-white/5 w-16 text-center">Ordem</th>
              <th className="p-4 border-r border-white/5 w-16 text-center">Status</th>
              <th className="p-4 border-r border-white/5 w-24 text-center">Ações</th>
              <th className="p-4 border-r border-white/5 w-20 text-center">WBS</th>
              <th className="p-4 border-r border-white/5 text-left min-w-[300px]">
                {isRevenueTable ? 'Receita / Descritivo' : 'Insumo / Despesa'}
              </th>
              <th className="p-4 border-r border-white/5 w-44 text-left">
                {isRevenueTable ? 'Datas (Emissão/Recebido)' : 'Datas (Gasto/Pgto)'}
              </th>
              <th className="p-4 border-r border-white/5 w-48 text-left">
                {isRevenueTable ? 'Origem' : 'Entidade'}
              </th>
              <th className="p-4 border-r border-white/5 w-16 text-center">Und</th>
              <th className="p-4 border-r border-white/5 w-20 text-center">Qtd</th>
              <th className="p-4 border-r border-white/5 w-28 text-right">Unitário</th>
              <th className="p-4 border-r border-white/5 w-28 text-right">Desconto</th>
              <th className="p-4 w-32 text-right">Total</th>
            </tr>
          </thead>
          <Droppable droppableId="expense-tree" direction="vertical" isCombineEnabled={!isReadOnly}>
            {(provided) => (
              <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isReadOnly}>
                    {(provided, snapshot) => (
                      <tr 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group transition-all ${item.itemType === 'category' ? (isRevenueTable ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'bg-slate-50/80 dark:bg-slate-800/40') : (isRevenueTable ? 'hover:bg-emerald-50/40' : 'hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10')} ${item.itemType === 'category' ? 'font-bold' : ''} ${item.isPaid ? 'opacity-70 grayscale-[0.3]' : ''} ${snapshot.isDragging ? 'dragging-row' : ''}`}
                      >
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <div {...provided.dragHandleProps} className={`p-1 transition-colors cursor-grab active:cursor-grabbing ${isRevenueTable ? 'text-emerald-200 hover:text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                              <GripVertical size={14} />
                            </div>
                            {!isReadOnly && (
                              <div className="flex flex-col">
                                <button onClick={() => onMoveManual(item.id, 'up')} className="text-slate-300 hover:text-indigo-500 transition-colors"><ChevronUp size={12}/></button>
                                <button onClick={() => onMoveManual(item.id, 'down')} className="text-slate-300 hover:text-indigo-500 transition-colors"><ChevronDown size={12}/></button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                          {item.itemType === 'item' && (
                            <button 
                              disabled={isReadOnly}
                              onClick={() => onTogglePaid(item.id)}
                              className={`p-2 rounded-xl transition-all ${item.isPaid ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'text-slate-300 hover:text-indigo-500'}`}
                              title={isRevenueTable ? (item.isPaid ? "Recebido" : "Marcar como Recebido") : (item.isPaid ? "Pago" : "Marcar como Pago")}
                            >
                              {item.isPaid ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button disabled={isReadOnly} onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"><Edit3 size={14}/></button>
                            <button disabled={isReadOnly} onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 rounded-lg transition-colors"><Trash2 size={14}/></button>
                          </div>
                        </td>
                        <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400 dark:text-slate-500">{item.wbs}</td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                            {item.itemType === 'category' ? (
                              <button onClick={() => onToggle(item.id)} className={`p-1 rounded-md transition-colors ${expandedIds.has(item.id) ? (isRevenueTable ? 'text-emerald-600 bg-emerald-100' : 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40') : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                                {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />}
                            
                            {item.itemType === 'category' ? <Layers size={14} className={isRevenueTable ? 'text-emerald-500' : 'text-indigo-500'} /> : (
                              item.type === 'revenue' ? <Landmark size={14} className="text-emerald-500 flex-shrink-0" /> : 
                              item.type === 'labor' ? <Users size={14} className="text-blue-400 flex-shrink-0" /> : 
                              <Truck size={14} className="text-slate-300 dark:text-slate-500 flex-shrink-0" />
                            )}

                            <span className={`truncate ${item.itemType === 'category' ? 'uppercase text-[10px] font-black dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'} ${item.isPaid ? 'line-through decoration-emerald-500/30' : ''}`}>{item.description}</span>
                            {item.itemType === 'category' && !isReadOnly && (
                              <div className="ml-auto lg:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button onClick={() => onAddChild(item.id, 'category')} className={`p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all`} title="Nova Subpasta"><FolderPlus size={14} /></button>
                                <button onClick={() => onAddChild(item.id, 'item')} className={`p-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500 dark:text-emerald-400 rounded-lg hover:bg-emerald-600 hover:text-white transition-all`} title="Novo Lançamento / Insumo"><FilePlus size={14} /></button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                          {item.itemType === 'item' ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <Calendar size={10} className="shrink-0" /> 
                                <span>{isRevenueTable ? 'Emissão' : 'Gasto'}: {financial.formatDate(item.date)}</span>
                              </div>
                              {item.paymentDate && (
                                <div className={`flex items-center gap-1 text-[9px] font-bold ${isRevenueTable ? 'text-emerald-600' : 'text-blue-600'}`}>
                                  <Clock size={9} className="shrink-0" /> 
                                  <span>{isRevenueTable ? 'Recebido' : 'Pgto'}: {financial.formatDate(item.paymentDate)}</span>
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 truncate">
                          {item.itemType === 'item' ? (item.entityName || '—') : '—'}
                        </td>
                        <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 dark:text-slate-500 uppercase text-[9px]">{item.unit || '-'}</td>
                        <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono dark:text-slate-300">{item.itemType === 'item' ? item.quantity : '-'}</td>
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono">
                          {item.itemType === 'item' ? (
                            <input 
                              disabled={isReadOnly}
                              type="text" 
                              className="w-full bg-transparent text-right font-mono outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1" 
                              key={`${item.id}-up-${item.unitPrice}`}
                              defaultValue={item.unitPrice.toFixed(2).replace('.', ',')} 
                              onBlur={(e) => onUpdateUnitPrice(item.id, parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0)} 
                            />
                          ) : '-'}
                        </td>
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 font-mono text-rose-500/80">
                          {item.itemType === 'item' && item.discountValue ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold">-{financial.formatBRL(item.discountValue).replace('R$', '')}</span>
                              <span className="text-[8px] font-black">{item.discountPercentage}% OFF</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-2 text-right">
                           {item.itemType === 'item' ? (
                             <input 
                               disabled={isReadOnly}
                               type="text" 
                               className={`w-full bg-transparent text-right font-black outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 ${isRevenueTable ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`} 
                               key={`${item.id}-amt-${item.amount}`}
                               defaultValue={item.amount.toFixed(2).replace('.', ',')} 
                               onBlur={(e) => onUpdateTotal(item.id, parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0)} 
                             />
                           ) : <span className={`font-black ${isRevenueTable ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>{financial.formatBRL(item.amount)}</span>}
                        </td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}

                <tr className={`${isRevenueTable ? 'bg-emerald-950' : 'bg-slate-950 dark:bg-black'} text-white font-black text-xs sticky bottom-0 z-10 shadow-2xl`}>
                  <td colSpan={5} className="p-4 text-right uppercase tracking-[0.2em] text-[10px] border-r border-white/10">
                    {isRevenueTable ? 'Total de Receitas' : 'Total de Despesas'}:
                  </td>
                  <td colSpan={6} className="p-4 border-r border-white/10 opacity-30 italic text-[9px]">
                    Soma líquida consolidada (considerando abatimentos e descontos)
                  </td>
                  <td className={`p-4 text-right text-base tracking-tighter ${isRevenueTable ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {financial.formatBRL(totalTable)}
                  </td>
                </tr>
              </tbody>
            )}
          </Droppable>
        </table>
      </DragDropContext>
    </div>
  );
};
