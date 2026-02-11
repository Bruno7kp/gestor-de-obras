
import React from 'react';
import { ProjectExpense } from '../types';
import { financial } from '../utils/math';
import {
  ChevronRight, ChevronDown, ChevronUp, Trash2, Edit3, Layers,
  Truck, CheckCircle2, GripVertical, Clock, Landmark, Receipt, Download, Coins, ArrowUpRight
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
  currencySymbol?: string;
}

export const ExpenseTreeTable: React.FC<ExpenseTreeTableProps> = ({
  data, expandedIds, onToggle, onEdit, onDelete, onAddChild, onUpdateTotal, onUpdateUnitPrice, onTogglePaid, onReorder, onMoveManual, isReadOnly, currencySymbol = 'R$'
}) => {
  const isRevenueTable = data.some(d => d.type === 'revenue');
  const isOtherTable = data.some(d => d.type === 'other');
  const apiBase = (import.meta as any).env?.VITE_API_URL ?? '';

  const resolveUploadUrl = (url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/uploads/')) {
      const baseOrigin = new URL(apiBase || '/', window.location.origin).origin;
      return `${baseOrigin}${url}`;
    }
    return url;
  };

  const handleDownloadDoc = (url: string, name: string) => {
    const resolvedUrl = resolveUploadUrl(url);
    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = name;
    link.click();
  };

  const handleDragEnd = (result: DropResult) => {
    if (isReadOnly || !result.destination) return;
    if (result.destination.index === result.source.index) return;
    const sourceId = result.draggableId;
    const targetId = data[result.destination.index].id;
    const position = result.destination.index < result.source.index ? 'before' : 'after';
    onReorder(sourceId, targetId, position);
  };

  const totalConsolidado = financial.sum(data.filter(i => i.depth === 0).map(i => i.amount));
  const totalColSpan = isOtherTable ? 8 : 11;

  return (
    <div className={`overflow-x-auto border rounded-3xl bg-white dark:bg-slate-900 shadow-xl transition-colors ${isRevenueTable ? 'border-emerald-100 dark:border-emerald-900' : 'border-slate-200 dark:border-slate-800'}`}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <table className="min-w-full border-collapse text-[11px]">
          <thead className={`${isRevenueTable ? 'bg-emerald-950 dark:bg-emerald-900/20' : 'bg-slate-900 dark:bg-black'} text-white sticky top-0 z-20`}>
            <tr className="uppercase tracking-widest font-black text-[9px] opacity-80">
              <th className="p-3 border-r border-slate-800 w-10 text-center"></th>
              <th className="p-4 border-r border-slate-800 w-16 text-center">Item</th>
              <th className="p-4 border-r border-slate-800 w-20 text-center">Status</th>
              <th className="p-4 border-r border-slate-800 w-36 text-center">Ações</th>
              <th className="p-4 border-r border-slate-800 text-left min-w-[300px]">Descrição / Fornecedor</th>
              <th className="p-4 border-r border-slate-800 w-44 text-left">Datas</th>
              {!isOtherTable && <th className="p-4 border-r border-slate-800 w-16 text-center">Und</th>}
              {!isOtherTable && <th className="p-4 border-r border-slate-800 w-20 text-center">Qtd</th>}
              {!isOtherTable && <th className="p-4 border-r border-slate-800 w-32 text-right">Unitário</th>}
              <th className="p-4 border-r border-slate-800 w-28 text-right">Desconto</th>
              <th className="p-4 border-r border-slate-800 w-28 text-right">Imposto</th>
              <th className="p-4 w-32 text-right">Total</th>
            </tr>
          </thead>
          <Droppable droppableId="expense-list-v4">
            {(provided) => (
              <tbody
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="divide-y divide-slate-100 dark:divide-slate-800"
              >
                {data.map((item, index) => (
                  <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isReadOnly}>
                    {(p, snapshot) => (
                      <tr
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`group transition-colors ${snapshot.isDragging ? 'bg-indigo-50 dark:bg-indigo-900/40 shadow-2xl z-50' : item.itemType === 'category' ? 'bg-slate-50/80 dark:bg-slate-800/40 font-bold' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
                      >
                        <td className="p-1 border-r border-slate-100 dark:border-slate-800 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onMoveManual(item.id, 'up');
                                }}
                                disabled={isReadOnly}
                                className={`p-0.5 rounded text-slate-300 hover:text-indigo-500 ${isReadOnly ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title="Mover para cima"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onMoveManual(item.id, 'down');
                                }}
                                disabled={isReadOnly}
                                className={`p-0.5 rounded text-slate-300 hover:text-indigo-500 ${isReadOnly ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title="Mover para baixo"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <div {...p.dragHandleProps} className="p-0.5 text-slate-300 group-hover:text-indigo-500 transition-colors cursor-grab active:cursor-grabbing">
                              <GripVertical size={14} />
                            </div>
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center font-mono text-[10px] text-slate-400">
                          {item.wbs}
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-center">
                          {item.itemType === 'item' && (
                            <div className="flex justify-center">
                              {item.status === 'DELIVERED' ? (
                                isOtherTable ? (
                                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center" title="Pago">
                                    <ArrowUpRight size={16} />
                                  </div>
                                ) : isRevenueTable ? (
                                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center" title="Faturado">
                                    <CheckCircle2 size={14} />
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center" title="No Local">
                                    <Truck size={14} />
                                  </div>
                                )
                              ) : item.status === 'PAID' ? (
                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center" title="Pago">
                                  <CheckCircle2 size={14} />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center" title={isRevenueTable ? 'Pendente' : 'Pendente'}>
                                  <Clock size={14} />
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg" title="Editar"><Edit3 size={14} /></button>
                            {item.itemType === 'item' && item.invoiceDoc && (
                              <button onClick={() => handleDownloadDoc(item.invoiceDoc!, `NF_${item.description}.pdf`)} className="p-1.5 text-emerald-400 hover:text-emerald-600 rounded-lg" title="Baixar Nota Fiscal"><Receipt size={14} /></button>
                            )}
                            {item.itemType === 'item' && item.paymentProof && (
                              <button onClick={() => handleDownloadDoc(item.paymentProof!, `COMPR_${item.description}.pdf`)} className="p-1.5 text-blue-400 hover:text-blue-600 rounded-lg" title="Baixar Comprovante"><Download size={14} /></button>
                            )}
                            <button onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 rounded-lg" title="Excluir"><Trash2 size={14} /></button>
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                            {item.itemType === 'category' ? (
                              <button onClick={() => onToggle(item.id)} className={`p-1 rounded-md transition-colors ${expandedIds.has(item.id) ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                                {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />}
                            <div className="flex flex-col min-w-0">
                              <span className={`truncate ${item.itemType === 'category' ? 'uppercase text-[10px] font-black' : 'text-slate-600 dark:text-slate-300'}`}>{item.description}</span>
                              {item.itemType === 'item' && <span className="text-[8px] font-bold text-slate-400 uppercase">{item.entityName || 'Sem Fornecedor'}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
                          {item.itemType === 'item' ? (
                            <div className="space-y-0.5">
                              <p>
                                {isRevenueTable
                                  ? item.status === 'PENDING' ? 'Pendente' : 'Faturado'
                                  : isOtherTable
                                    ? item.isPaid ? 'Transferido' : item.status === 'PENDING' ? 'Pendencia' : 'Competencia'
                                    : item.isPaid ? 'Pago' : item.status === 'PENDING' ? 'Pendencia' : 'Competencia'}: {financial.formatDate(item.isPaid ? (item.paymentDate || item.date) : item.date)}
                              </p>
                              {item.deliveryDate && item.type !== 'other' && (
                                <p className="text-emerald-600 font-bold">Entregue: {financial.formatDate(item.deliveryDate)}</p>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        {!isOtherTable && (
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
                        )}
                        {!isOtherTable && (
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono">{item.itemType === 'item' ? financial.formatQuantity(item.quantity) : '-'}</td>
                        )}
                        {!isOtherTable && (
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 font-mono">
                            {item.itemType === 'item' ? financial.formatVisual(item.unitPrice, currencySymbol) : '-'}
                          </td>
                        )}
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-rose-500 font-mono">
                          {item.itemType === 'item' && (item.discountValue || item.discountPercentage) ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold">-{financial.formatVisual(item.discountValue || 0, currencySymbol)}</span>
                              <span className="text-[8px] opacity-60">({item.discountPercentage || 0}%)</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-emerald-500 font-mono">
                          {item.itemType === 'item' && (item.issValue || item.issPercentage) ? (
                            <div className="flex flex-col items-end">
                              <span className="font-bold">-{financial.formatVisual(item.issValue || 0, currencySymbol)}</span>
                              <span className="text-[8px] opacity-60">({item.issPercentage || 0}%)</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-2 text-right">
                          <span className={`font-black ${isRevenueTable ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'}`}>{financial.formatVisual(item.amount, currencySymbol)}</span>
                        </td>
                      </tr>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
          <tfoot className="bg-slate-900 dark:bg-black text-white font-black text-xs sticky bottom-0 z-20 shadow-2xl">
            <tr className="border-t border-slate-700">
              <td colSpan={totalColSpan} className="p-4 text-right uppercase tracking-[0.2em] text-[9px] border-r border-slate-800 opacity-70">
                Total Consolidado da Tabela:
              </td>
              <td className="p-4 text-right text-sm tracking-tighter whitespace-nowrap">
                <span className={`font-black ${isRevenueTable ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {financial.formatVisual(totalConsolidado, currencySymbol)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </DragDropContext>
    </div>
  );
};
