
import React, { useEffect, useState, useRef } from 'react';
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
  GripVertical,
  Eye,
  Columns,
  Lock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { uiPreferences } from '../utils/uiPreferences';

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
  onUpdateGrandTotal: (overrides: { contract?: number; current?: number }) => void;
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  searchQuery: string;
  isReadOnly?: boolean;
  currencySymbol?: string;
  contractTotalOverride?: number;
  currentTotalOverride?: number;
  onScrollContainer?: (el: HTMLDivElement | null) => void;
}

type ColumnView = 'full' | 'contractual' | 'measurement' | 'minimal';

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
  onUpdateGrandTotal,
  onReorder,
  searchQuery,
  isReadOnly = false,
  currencySymbol = 'R$',
  contractTotalOverride,
  currentTotalOverride,
  onScrollContainer
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const viewKey = 'promeasure_table_view';
  const moverKey = 'promeasure_col_mover';
  const acoesKey = 'promeasure_col_acoes';
  const fonteKey = 'promeasure_col_fonte';
  const codKey = 'promeasure_col_cod';
  const [view, setView] = useState<ColumnView>(() => {
    return (uiPreferences.getString(viewKey) as ColumnView) || 'full';
  });
  const [showMover, setShowMover] = useState(() => uiPreferences.getString(moverKey) !== 'false');
  const [showAcoes, setShowAcoes] = useState(() => uiPreferences.getString(acoesKey) !== 'false');
  const [showFonte, setShowFonte] = useState(() => uiPreferences.getString(fonteKey) !== 'false');
  const [showCod, setShowCod] = useState(() => uiPreferences.getString(codKey) !== 'false');

  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  useEffect(() => {
    uiPreferences.setString(viewKey, view);
    uiPreferences.setString(moverKey, String(showMover));
    uiPreferences.setString(acoesKey, String(showAcoes));
    uiPreferences.setString(fonteKey, String(showFonte));
    uiPreferences.setString(codKey, String(showCod));
  }, [view, showMover, showAcoes, showFonte, showCod, viewKey, moverKey, acoesKey, fonteKey, codKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onScrollContainer) return;
    onScrollContainer(el);
  }, [onScrollContainer]);

  const handleToggleDesc = (id: string) => {
    const next = new Set(expandedDescriptions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedDescriptions(next);
  };

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

  const showUnitary = view === 'full' || view === 'contractual';
  const showContract = view === 'full' || view === 'contractual';
  const showPrevious = view === 'full' || view === 'measurement';
  const showCurrent = view === 'full' || view === 'measurement' || view === 'minimal';
  const showAccumulated = view === 'full' || view === 'measurement' || view === 'minimal';
  const showBalance = view === 'full';

  const calculateConsolidatedColSpan = () => {
    let base = 3; // ITEM + EAP (Descrição) + UND
    if (showMover) base++;
    if (showAcoes) base++;
    if (showFonte) base++;
    if (showCod) base++;
    return base;
  };

  const rootItems = data.filter(i => i.depth === 0);
  const totalContract = contractTotalOverride ?? financial.sum(rootItems.map(i => i.contractTotal));
  const totalCurrent = currentTotalOverride ?? financial.sum(rootItems.map(i => i.currentTotal));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2">
          <button onClick={onExpandAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <Maximize2 size={12} /> <span className="hidden xs:inline">Expandir</span>
          </button>
          <button onClick={onCollapseAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <Minimize2 size={12} /> <span className="hidden xs:inline">Recolher</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 mr-1">
            <Eye size={12}/> Visão:
          </div>
          {(['full', 'contractual', 'measurement', 'minimal'] as ColumnView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${view === v ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {v === 'full' ? 'Completa' : v === 'contractual' ? 'Contrato' : v === 'measurement' ? 'Medição' : 'Foco'}
            </button>
          ))}
          
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          
          <div className="flex items-center gap-1">
            <VisibilityToggle label="MOVER" active={showMover} onClick={() => setShowMover(!showMover)} />
            <VisibilityToggle label="AÇÕES" active={showAcoes} onClick={() => setShowAcoes(!showAcoes)} />
            <VisibilityToggle label="FONTE" active={showFonte} onClick={() => setShowFonte(!showFonte)} />
            <VisibilityToggle label="CÓDIGO" active={showCod} onClick={() => setShowCod(!showCod)} />
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-xl custom-scrollbar max-h-[70vh]"
        style={{ overflowAnchor: 'none' }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="min-w-max w-full border-collapse text-[11px]">
            <thead className="bg-slate-900 dark:bg-black text-white sticky top-0 z-30">
              <tr className="uppercase tracking-widest font-black text-[9px] opacity-80 text-center">
                {showMover && <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-16 no-print">Mover</th>}
                {showAcoes && <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-24">Ações</th>}
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-16">ITEM</th>
                {showFonte && <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-20">FONTE</th>}
                {showCod && <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-20">Código</th>}
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 text-left w-[400px] min-w-[400px] max-w-[400px]">Descrição da EAP</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-14">Und</th>
                <th rowSpan={2} className="p-4 border-r border-slate-800 dark:border-slate-900 w-18">Qtd</th>
                
                {showUnitary && <th colSpan={2} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-slate-800/50">Unitário ({currencySymbol})</th>}
                {showContract && <th className="p-2 border-r border-slate-800 dark:border-slate-800 bg-slate-800/30">Contrato</th>}
                {showPrevious && <th colSpan={2} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-amber-900/20">Anterior</th>}
                {showCurrent && <th colSpan={3} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-blue-900/20">Período</th>}
                {showAccumulated && <th colSpan={3} className="p-2 border-r border-slate-800 dark:border-slate-900 bg-emerald-900/20">Acumulado</th>}
                {showBalance && <th colSpan={2} className="p-2 bg-rose-900/20">Saldo</th>}
                
                <th rowSpan={2} className="p-4 w-10 text-center">% EXEC.</th>
              </tr>
              <tr className="text-[8px] bg-slate-800 dark:bg-slate-950 font-bold uppercase text-center">
                {showUnitary && (
                  <>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-24 text-right">S/ BDI</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-24 text-right">C/ BDI</th>
                  </>
                )}
                {showContract && (
                  <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                )}
                {showPrevious && (
                  <>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16">Qtd</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                  </>
                )}
                {showCurrent && (
                  <>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-12">%</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16">Qtd</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                  </>
                )}
                {showAccumulated && (
                  <>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16">Qtd</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-32 text-right">Total</th>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-12">%</th>
                  </>
                )}
                {showBalance && (
                  <>
                    <th className="p-2 border-r border-slate-700 dark:border-slate-800 w-16">Qtd</th>
                    <th className="p-2 w-32 text-right">Total</th>
                  </>
                )}
              </tr>
            </thead>
            
            {/* Fix: Changed isDragDisabled to isDropDisabled on Droppable component */}
            <Droppable droppableId="wbs-tree" direction="vertical" isDropDisabled={isReadOnly} isCombineEnabled={!isReadOnly}>
              {(provided) => (
                <tbody 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="divide-y divide-slate-100 dark:divide-slate-800"
                >
                  {filteredData.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isReadOnly}>
                      {(provided, snapshot) => {
                        const isExpandedDesc = expandedDescriptions.has(item.id);
                        const isFullyMeasuredPreviously = item.type === 'item' && item.previousQuantity >= item.contractQuantity;
                        
                        return (
                          <tr ref={provided.innerRef} data-row-id={item.id} {...provided.draggableProps} className={`group transition-all duration-150 ${item.type === 'category' ? 'bg-slate-50/80 dark:bg-slate-800/40 font-bold' : 'hover:bg-blue-50/40 dark:hover:bg-blue-900/10'} ${snapshot.isDragging ? 'dragging-row shadow-2xl z-50' : ''} ${isFullyMeasuredPreviously ? 'opacity-70 bg-slate-50/30' : ''}`}>
                            {showMover && (
                              <td className="p-2 border-r border-slate-100 dark:border-slate-800 no-print text-center">
                                <div {...provided.dragHandleProps} className="inline-flex p-1.5 text-slate-300 hover:text-indigo-500 transition-colors cursor-grab active:cursor-grabbing">
                                  <GripVertical size={16} />
                                </div>
                              </td>
                            )}
                            {showAcoes && (
                              <td className="p-2 border-r border-slate-100 dark:border-slate-800 no-print">
                                <div className="flex items-center justify-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button disabled={isReadOnly} onClick={() => onEdit(item)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg" title="Editar"><Edit3 size={14}/></button>
                                  <button disabled={isReadOnly} onClick={() => onDelete(item.id)} className="p-1.5 text-rose-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg" title="Excluir"><Trash2 size={14}/></button>
                                </div>
                              </td>
                            )}
                            <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-[10px] text-slate-400 dark:text-slate-500">{item.wbs}</td>
                            {showFonte && <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">{item.fonte || '-'}</td>}
                            {showCod && <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono text-[10px]">{item.cod || '-'}</td>}
                            <td className="p-2 border-r border-slate-100 dark:border-slate-800 w-[400px] min-w-[400px] max-w-[400px]">
                              <div className="flex items-start gap-1 h-full">
                                <div className="flex items-center gap-2" style={{ marginLeft: `${item.depth * 1.5}rem` }}>
                                  {item.type === 'category' ? (
                                    <button onClick={() => onToggle(item.id)} className={`p-1 rounded-md transition-colors ${expandedIds.has(item.id) ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' : 'text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                                      {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                  ) : <div className="w-6 h-px bg-slate-200 dark:bg-slate-700" />}
                                  {item.type === 'category' ? <Layers size={14} className="text-blue-500 flex-shrink-0 mt-0.5" /> : (
                                    isFullyMeasuredPreviously 
                                    ? <Lock size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                    : <Package size={14} className="text-slate-300 flex-shrink-0 mt-0.5" />
                                  )}
                                  
                                  <button 
                                    onClick={() => handleToggleDesc(item.id)}
                                    className={`text-left outline-none cursor-pointer overflow-hidden leading-tight transition-all duration-300 ${isExpandedDesc ? '' : 'line-clamp-2'} ${item.type === 'category' ? 'text-slate-900 dark:text-slate-100 uppercase text-[10px] font-black' : 'text-slate-600 dark:text-slate-300'}`}
                                  >
                                    {item.name}
                                  </button>

                                  {item.type === 'category' && !isReadOnly && (
                                    <div className="ml-auto lg:opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                      <button onClick={() => onAddChild(item.id, 'category')} className="p-1 text-slate-400 hover:text-blue-600" title="Add Grupo"><FolderPlus size={14} /></button>
                                      <button onClick={() => onAddChild(item.id, 'item')} className="p-1 text-slate-400 hover:text-emerald-600" title="Add Serviço"><FilePlus size={14} /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
                            <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 font-mono text-slate-500 dark:text-slate-400">{item.type === 'item' ? item.contractQuantity : '-'}</td>
                            
                            {showUnitary && (
                              <>
                                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-mono text-[10px] whitespace-nowrap">{item.type === 'item' ? financial.formatVisual(item.unitPriceNoBdi, currencySymbol) : '-'}</td>
                                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.type === 'item' ? financial.formatVisual(item.unitPrice, currencySymbol) : '-'}</td>
                              </>
                            )}

                            {showContract && (
                              <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 whitespace-nowrap">
                                {item.type === 'item' ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-[8px] text-slate-400 font-black">{currencySymbol}</span>
                                    <ItemTotalInput 
                                      value={item.contractTotal} 
                                      onUpdate={(val: number) => onUpdateTotal(item.id, val)} 
                                      disabled={isReadOnly || isFullyMeasuredPreviously}
                                      currencySymbol={currencySymbol}
                                    />
                                  </div>
                                ) : <span className="font-bold text-slate-900 dark:text-slate-100">{financial.formatVisual(item.contractTotal, currencySymbol)}</span>}
                              </td>
                            )}

                            {showPrevious && (
                              <>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-amber-50/10 dark:bg-amber-900/10 text-slate-400 dark:text-slate-500 font-mono">{item.type === 'item' ? item.previousQuantity : '-'}</td>
                                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-amber-50/10 dark:bg-amber-900/10 text-slate-400 dark:text-slate-500 whitespace-nowrap">{financial.formatVisual(item.previousTotal, currencySymbol)}</td>
                              </>
                            )}

                            {showCurrent && (
                              <>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/10">
                                  {item.type === 'item' ? (
                                    <PercentageInput 
                                      value={item.currentPercentage} 
                                      onChange={(val) => onUpdatePercentage(item.id, val)}
                                      disabled={isReadOnly || isFullyMeasuredPreviously}
                                    />
                                  ) : '-'}
                                </td>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-blue-50/20 dark:bg-blue-900/10">
                                  {item.type === 'item' ? (
                                    <input 
                                      disabled={isReadOnly || isFullyMeasuredPreviously} 
                                      type="number" 
                                      step="any" 
                                      className={`w-16 bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded px-1 py-0.5 text-center text-[10px] font-bold focus:ring-2 focus:ring-blue-500/20 outline-none ${isFullyMeasuredPreviously ? 'text-slate-400 bg-slate-50' : 'text-blue-700 dark:text-blue-300'}`} 
                                      value={item.currentQuantity} 
                                      onChange={(e) => onUpdateQuantity(item.id, parseFloat(e.target.value) || 0)} 
                                    />
                                  ) : '-'}
                                </td>
                                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-900/20 whitespace-nowrap">
                                  {item.type === 'item' ? (
                                    <div className="flex items-center justify-end">
                                      <span className="text-[9px] text-blue-300 mr-1">{currencySymbol}</span>
                                      <ItemTotalInput 
                                        value={item.currentTotal} 
                                        onUpdate={(val: number) => onUpdateCurrentTotal(item.id, val)} 
                                        disabled={isReadOnly || isFullyMeasuredPreviously}
                                        currencySymbol={currencySymbol}
                                        textColorClass={isFullyMeasuredPreviously ? "text-slate-400" : "text-blue-700 dark:text-blue-300"}
                                      />
                                    </div>
                                  ) : <span className="font-black text-blue-700 dark:text-blue-300">{financial.formatVisual(item.currentTotal, currencySymbol)}</span>}
                                </td>
                              </>
                            )}

                            {showAccumulated && (
                              <>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-emerald-50/10 dark:bg-emerald-900/10 font-bold text-slate-500 dark:text-slate-400 font-mono">{item.type === 'item' ? item.accumulatedQuantity : '-'}</td>
                                <td className="p-2 text-right border-r border-slate-100 dark:border-slate-800 bg-emerald-50/10 dark:bg-emerald-900/10 font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{financial.formatVisual(item.accumulatedTotal, currencySymbol)}</td>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-emerald-50/30 dark:bg-emerald-900/20 font-black text-emerald-800 dark:text-emerald-100 text-[10px]">{item.accumulatedPercentage}%</td>
                              </>
                            )}

                            {showBalance && (
                              <>
                                <td className="p-2 text-center border-r border-slate-100 dark:border-slate-800 bg-rose-50/10 dark:bg-rose-900/10 font-bold text-rose-600/60 dark:text-rose-400/60 font-mono">{item.type === 'item' ? item.balanceQuantity : '-'}</td>
                                <td className="p-2 text-right bg-rose-50/20 dark:bg-rose-900/10 font-black text-rose-800 dark:text-rose-300 whitespace-nowrap">{financial.formatVisual(item.balanceTotal, currencySymbol)}</td>
                              </>
                            )}

                            <td className="p-2 text-center font-black text-slate-700 dark:text-slate-200">{item.accumulatedPercentage}%</td>
                          </tr>
                        );
                      }}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>

            <tfoot className="bg-slate-950 dark:bg-black text-white font-black text-xs sticky bottom-0 z-40 shadow-2xl">
              <tr className="border-t border-white/20">
                <td colSpan={calculateConsolidatedColSpan() + 1} className="p-5 text-right uppercase tracking-[0.2em] text-[10px] border-r border-white/10">Consolidado Total da Planilha:</td>
                
                {showUnitary && <td colSpan={2} className="p-4 border-r border-white/10 opacity-30 italic text-[8px] text-center">Médias Unitárias</td>}
                
                {showContract && (
                  <td className="p-4 border-r border-white/10 text-right text-base tracking-tighter whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-slate-400 font-black">{currencySymbol}</span>
                      <GrandTotalInput 
                        initialValue={totalContract} 
                        onUpdate={(val: number) => onUpdateGrandTotal({ contract: val })}
                        disabled={isReadOnly}
                      />
                    </div>
                  </td>
                )}

                {showPrevious && (
                  <td colSpan={2} className="p-4 border-r border-white/10 text-right opacity-50 whitespace-nowrap">
                    {financial.formatVisual(financial.sum(rootItems.map(i => i.previousTotal)), currencySymbol)}
                  </td>
                )}

                {showCurrent && (
                  <>
                    <td colSpan={2} className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-blue-400 text-base tracking-tighter whitespace-nowrap">
                       <div className="flex items-center justify-end gap-1">
                        <span className="text-[10px] text-blue-500 font-black">{currencySymbol}</span>
                        <GrandTotalInput 
                          initialValue={totalCurrent} 
                          onUpdate={(val: number) => onUpdateGrandTotal({ current: val })}
                          disabled={isReadOnly}
                          textColorClass="text-blue-400"
                        />
                      </div>
                    </td>
                  </>
                )}

                {showAccumulated && (
                  <>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-emerald-400 text-base tracking-tighter whitespace-nowrap">
                      {financial.formatVisual(financial.sum(rootItems.map(i => i.accumulatedTotal)), currencySymbol)}
                    </td>
                    <td className="p-4 border-r border-white/10"></td>
                  </>
                )}

                {showBalance && (
                  <>
                    <td className="p-4 border-r border-white/10"></td>
                    <td className="p-4 border-r border-white/10 text-right text-rose-400 text-base tracking-tighter whitespace-nowrap">
                      {financial.formatVisual(financial.sum(rootItems.map(i => i.balanceTotal)), currencySymbol)}
                    </td>
                  </>
                )}

                <td className="p-4 text-center">100%</td>
              </tr>
            </tfoot>
          </table>
        </DragDropContext>
      </div>
    </div>
  );
};

const VisibilityToggle = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${active ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 opacity-50 hover:opacity-100'}`}
  >
    {label}
  </button>
);

const PercentageInput = ({ value, onChange, disabled }: { value: number, onChange: (val: number) => void, disabled: boolean }) => {
  const [localVal, setLocalVal] = useState(value.toString());
  useEffect(() => { setLocalVal(value.toString()); }, [value]);

  return (
    <div className="flex items-center justify-center gap-1">
      <input 
        disabled={disabled} 
        type="text" 
        className={`w-12 bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800 rounded px-1 py-0.5 text-center text-[10px] font-bold outline-none focus:ring-1 focus:ring-blue-500 ${disabled ? 'text-slate-400 bg-slate-50' : 'text-blue-600 dark:text-blue-400'}`} 
        value={localVal} 
        onChange={(e) => setLocalVal(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={(e) => {
          const v = Math.min(100, parseFloat(e.target.value) || 0);
          onChange(v);
          setLocalVal(v.toString());
        }}
      />
      <span className="text-[8px] text-blue-400 font-black">%</span>
    </div>
  );
};

const ItemTotalInput = ({ value, onUpdate, disabled, currencySymbol, textColorClass = "text-slate-900 dark:text-slate-100" }: any) => {
  const [localVal, setLocalVal] = useState(financial.formatVisual(value, currencySymbol).replace(currencySymbol, '').trim());
  useEffect(() => { setLocalVal(financial.formatVisual(value, currencySymbol).replace(currencySymbol, '').trim()); }, [value, currencySymbol]);

  return (
    <input 
      disabled={disabled} 
      type="text" 
      className={`w-full bg-transparent text-right font-bold ${textColorClass} outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 ${disabled ? 'opacity-50' : ''}`} 
      value={localVal}
      onChange={(e) => setLocalVal(financial.maskCurrency(e.target.value))}
      onBlur={(e) => onUpdate(financial.parseLocaleNumber(e.target.value))}
    />
  );
};

const GrandTotalInput = ({ initialValue, onUpdate, disabled, textColorClass = "text-white" }: any) => {
  const [localVal, setLocalVal] = useState(financial.formatVisual(initialValue, '').trim());
  useEffect(() => { setLocalVal(financial.formatVisual(initialValue, '').trim()); }, [initialValue]);

  return (
    <input 
      disabled={disabled}
      type="text"
      className={`bg-transparent text-right font-black ${textColorClass} outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 w-40`}
      value={localVal}
      onChange={(e) => setLocalVal(financial.maskCurrency(e.target.value))}
      onBlur={(e) => onUpdate(financial.parseLocaleNumber(e.target.value))}
    />
  );
};
