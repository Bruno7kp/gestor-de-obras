import React from 'react';
import { WorkItem } from '../types';
import { financial } from '../utils/math';
import { 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Edit3, 
  Package, 
  Layers, 
  Maximize2, 
  Minimize2,
  FolderPlus,
  FilePlus,
  GripVertical
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface TreeTableProps {
  data: (WorkItem & { depth: number })[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onEdit: (item: WorkItem) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string, type: 'category' | 'item') => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdatePercentage: (id: string, pct: number) => void;
  onUpdateTotal: (id: string, total: number) => void;
  onUpdateCurrentTotal: (id: string, total: number) => void;
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  searchQuery: string;
  isReadOnly?: boolean;
}

export const TreeTable: React.FC<TreeTableProps> = ({ 
  data, 
  expandedIds, 
  onToggle, 
  onExpandAll,
  onCollapseAll,
  onEdit, 
  onDelete,
  onAddChild,
  onUpdateQuantity,
  onUpdatePercentage,
  onUpdateTotal,
  onUpdateCurrentTotal,
  onReorder,
  searchQuery,
  isReadOnly = false
}) => {
  const filteredData = searchQuery.trim() 
    ? data.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.wbs.includes(searchQuery))
    : data;

  const handleDragEnd = (result: DropResult) => {
    if (isReadOnly) return;
    const sourceId = result.draggableId;

    if (result.combine) {
      const targetId = result.combine.draggableId;
      const targetItem = filteredData.find(d => d.id === targetId);
      if (targetItem && targetItem.type === 'category') {
        onReorder(sourceId, targetId, 'inside');
      }
      return;
    }

    if (!result.destination) return;
    const targetIdx = result.destination.index;
    const targetItem = filteredData[targetIdx];
    if (!targetItem) return;
    onReorder(sourceId, targetItem.id, 'after');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 no-print">
        <button onClick={onExpandAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-all shadow-sm">
          <Maximize2 size={12} /> <span className="hidden xs:inline">Expandir</span>
        </button>
        <button onClick={onCollapseAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg transition-all shadow-sm">
          <Minimize2 size={12} /> <span className="hidden xs:inline">Recolher</span>
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-xl">
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="min-w-[2050px] w-full border-collapse text-[11px]">
            <thead className="bg-slate-900 dark:bg-black text-white sticky top-0 z-20">
              <tr className="uppercase tracking-widest font-black text-[9px] opacity-80">
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-16 no-print text-center">Mover</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-24 text-center">Ações</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-16 text-center">ITEM</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-20 text-center">FONTE</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-20 text-center">Código</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 text-left min-w-[450px]">Estrutura Analítica do Projeto (EAP)</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-14 text-center">Und</th>
                <th colSpan={2} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-slate-800/50">Unitário (R$)</th>
                <th colSpan={2} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-slate-800/30">Planilha Contratual</th>
                <th colSpan={2} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-amber-900/20">Anterior</th>
                <th colSpan={3} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-blue-900/20">Período Corrente</th>
                <th colSpan={3} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-emerald-900/20">Acumulado Total</th>
                <th colSpan={2} className="p-2 bg-rose-900/20">Saldo</th>
                <th rowSpan={2} className="p-4 w-10 text-center">% EXEC.</th>
              </tr>
              <tr className="text-[8px] bg-slate-800 dark:bg-slate-950 font-bold uppercase">
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-24">S/ BDI</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-24">C/ BDI</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16 text-center">Qtd</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16 text-center">Qtd</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-12 text-center">%</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16 text-center">Qtd</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16 text-center">Qtd</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-12 text-center">%</th>
                <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16 text-center">Qtd</th>
                <th className="p-2 w-32 text-right">Total</th>
              </tr>
            </thead>
            
            <Droppable droppableId="wbs-tree" direction="vertical" isCombineEnabled={!isReadOnly}>
              {(provided) => (
                <tbody 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="divide-y divide-slate-100 dark:divide-slate-800"
                >
                  {filteredData.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isReadOnly}>
                      {(provided, snapshot) => (
                        <tr ref={provided.innerRef} {...provided.draggableProps} className={`group transition-all duration-150 ${item.type === 'category' ? 'bg-slate-50/80 dark:bg-slate-800/40 font-bold' : 'hover:bg-blue-50/40 dark:hover:bg-blue-900/10'} ${snapshot.isDragging ? 'dragging-row' : ''} ${snapshot.combineWith ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}>
                          <td className="p-2 border-r border-slate-100 dark:border-slate-800 no-print text-center">
                            <div {...provided.dragHandleProps} className="inline-flex p-1.5 text-slate-300 hover:text-indigo-500 transition-colors cursor-grab active:cursor-grabbing">
                              <GripVertical size={16} />
                            </div>
                          </td>
                          <td className="p-2 border-r border-slate-100 dark:border-slate-800 no-print">
                            <div className="flex items-center justify-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button disabled={isReadOnly} onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-20"><Edit3 size={14}/></button>
                              <button disabled={isReadOnly} onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg disabled:opacity-20"><Trash2 size={14}/></button>
                            </div>
                          </td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400 dark:text-slate-500">{item.wbs}</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">{item.fonte || '-'}</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono text-[10px]">{item.cod || '-'}</td>
                          <td className="p-2 border-r border-slate-100 dark:border-slate-800 relative min-w-[400px]">
                            <div className="flex items-center gap-1 h-full">
                              <div className="flex items-center gap-2" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                                {item.type === 'category' ? (
                                  <button onClick={() => onToggle(item.id)} className={`p-1 rounded-md transition-colors ${expandedIds.has(item.id) ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                                    {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />}
                                {item.type === 'category' ? <Layers size={14} className="text-blue-500 flex-shrink-0" /> : <Package size={14} className="text-slate-300 flex-shrink-0" />}
                                <span className={`truncate ${item.type === 'category' ? 'text-slate-900 dark:text-slate-100 uppercase text-[10px] font-black' : 'text-slate-600 dark:text-slate-300'}`}>{item.name}</span>
                                {item.type === 'category' && !isReadOnly && (
                                  <div className="ml-auto lg:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                    <button onClick={() => onAddChild(item.id, 'category')} className="p-1 text-slate-400 hover:text-blue-600"><FolderPlus size={14} /></button>
                                    <button onClick={() => onAddChild(item.id, 'item')} className="p-1 text-slate-400 hover:text-emerald-600"><FilePlus size={14} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono text-[10px]">{item.type === 'item' ? financial.formatVisual(item.unitPriceNoBdi) : '-'}</td>
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300">{item.type === 'item' ? financial.formatVisual(item.unitPrice) : '-'}</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-mono">{item.type === 'item' ? item.contractQuantity : '-'}</td>
                          
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40">
                             {item.type === 'item' ? (
                               <input 
                                 disabled={isReadOnly} 
                                 type="text" 
                                 className="w-full bg-transparent text-right font-bold text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1" 
                                 defaultValue={financial.formatVisual(item.contractTotal).replace('R$ ', '')} 
                                 onBlur={(e) => onUpdateTotal(item.id, financial.parseLocaleNumber(e.target.value))} 
                               />
                             ) : <span className="font-bold text-slate-900 dark:text-slate-100">{financial.formatVisual(item.contractTotal)}</span>}
                          </td>

                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-amber-50/10 dark:bg-amber-900/10 text-slate-400 dark:text-slate-500 font-mono">{item.type === 'item' ? item.previousQuantity : '-'}</td>
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-amber-50/10 dark:bg-amber-900/10 text-slate-400 dark:text-slate-500">{financial.formatVisual(item.previousTotal)}</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/10">
                            {item.type === 'item' ? (
                              <div className="flex items-center justify-center gap-1">
                                <input disabled={isReadOnly} type="number" className="w-12 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800 rounded px-1 py-0.5 text-center text-[10px] font-bold text-blue-600 dark:text-blue-400 outline-none" value={item.currentPercentage} onChange={(e) => onUpdatePercentage(item.id, parseFloat(e.target.value) || 0)} />
                                <span className="text-[8px] text-blue-400 font-black">%</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/10">
                            {item.type === 'item' ? (
                              <input disabled={isReadOnly} type="number" className="w-16 bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded px-1 py-0.5 text-center text-[10px] font-bold text-blue-700 dark:text-blue-300 focus:ring-2 focus:ring-blue-500/20 outline-none" value={item.currentQuantity} onChange={(e) => onUpdateQuantity(item.id, parseFloat(e.target.value) || 0)} />
                            ) : '-'}
                          </td>

                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-900/20">
                             {item.type === 'item' ? (
                               <input 
                                 disabled={isReadOnly} 
                                 type="text" 
                                 className="w-full bg-transparent text-right font-black text-blue-700 dark:text-blue-300 outline-none focus:ring-1 focus:ring-blue-500 rounded px-1" 
                                 defaultValue={financial.formatVisual(item.currentTotal).replace('R$ ', '')} 
                                 onBlur={(e) => onUpdateCurrentTotal(item.id, financial.parseLocaleNumber(e.target.value))} 
                               />
                             ) : <span className="font-black text-blue-700 dark:text-blue-300">{financial.formatVisual(item.currentTotal)}</span>}
                          </td>

                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-emerald-50/10 dark:bg-emerald-900/10 font-bold text-slate-500 dark:text-slate-400 font-mono">{item.type === 'item' ? item.accumulatedQuantity : '-'}</td>
                          <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-emerald-50/10 dark:bg-emerald-900/10 font-black text-emerald-700 dark:text-emerald-400">{financial.formatVisual(item.accumulatedTotal)}</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/20 font-black text-emerald-800 dark:text-emerald-100 text-[10px]">{item.accumulatedPercentage}%</td>
                          <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-rose-50/10 dark:bg-rose-900/10 font-bold text-rose-600/60 dark:text-rose-400/60 font-mono">{item.type === 'item' ? item.balanceQuantity : '-'}</td>
                          <td className="p-2 text-right bg-rose-50/20 dark:bg-rose-900/10 font-black text-rose-800 dark:text-rose-300">{financial.formatVisual(item.balanceTotal)}</td>
                          <td className="p-2 text-center font-black text-slate-700 dark:text-slate-200">{item.accumulatedPercentage}%</td>
                        </tr>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  
                  <tr className="bg-slate-950 dark:bg-black text-white font-black text-xs sticky bottom-0 z-10 shadow-2xl">
                    <td colSpan={7} className="p-5 text-right uppercase tracking-[0.2em] text-[10px] border-r border-white/10">Consolidado:</td>
                    <td colSpan={2} className="p-4 border-r border-white/10 opacity-30 italic">Preços Médios</td>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-base tracking-tighter">{financial.formatVisual(financial.sum(filteredData.filter(i => i.depth === 0).map(i => i.contractTotal)))}</td>
                    <td colSpan={2} className="p-4 border-r border-white/10 text-right opacity-50">{financial.formatVisual(financial.sum(filteredData.filter(i => i.depth === 0).map(i => i.previousTotal)))}</td>
                    <td colSpan={2} className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-blue-400 text-base tracking-tighter">{financial.formatVisual(financial.sum(filteredData.filter(i => i.depth === 0).map(i => i.currentTotal)))}</td>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-emerald-400 text-base tracking-tighter">{financial.formatVisual(financial.sum(filteredData.filter(i => i.depth === 0).map(i => i.accumulatedTotal)))}</td>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-rose-400 text-base tracking-tighter">{financial.formatVisual(financial.sum(filteredData.filter(i => i.depth === 0).map(i => i.balanceTotal)))}</td>
                    <td className="p-4 text-center">100%</td>
                  </tr>
                </tbody>
              )}
            </Droppable>
          </table>
        </DragDropContext>
      </div>
    </div>
  );
};