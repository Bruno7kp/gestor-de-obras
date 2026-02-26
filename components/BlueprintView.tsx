
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Project, WorkItem, ItemType } from '../types';
import { treeService } from '../services/treeService';
import { financial } from '../utils/math';
import { workItemsApi } from '../services/workItemsApi';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, Layers, Search, Package, ChevronRight, ChevronDown, 
  Edit3, Trash2, GripVertical, Calculator, Coins, Ruler
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface BlueprintViewProps {
  project: Project;
  onUpdateProject: (data: Partial<Project>) => void;
  onOpenModal: (type: ItemType, item: WorkItem | null, parentId: string | null) => void;
  isReadOnly?: boolean;
}

export const BlueprintView: React.FC<BlueprintViewProps> = ({ 
  project, onUpdateProject, onOpenModal, isReadOnly 
}) => {
  const { canEdit } = usePermissions();
  const canEditBlueprint = canEdit('blueprint') && !isReadOnly;

  // --- Refs for scroll preservation (same pattern as WbsView) ---
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollParentRef = useRef<HTMLElement | null>(null);
  const scrollTopRef = useRef(0);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ pageTop: number; tableTop: number; tableLeft: number } | null>(null);
  const lastEditedIdRef = useRef<string | null>(null);

  // --- Local items state (optimistic, mirrors WbsView pattern) ---
  const [localItems, setLocalItems] = useState<WorkItem[]>(project.items);
  const localItemsRef = useRef<WorkItem[]>(project.items);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(`exp_blueprint_${project.id}`);
    return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
  });

  // --- Sync local state from parent ---
  useEffect(() => {
    localItemsRef.current = project.items;
    setLocalItems(project.items);
  }, [project.id, project.items]);

  useEffect(() => {
    localStorage.setItem(`exp_blueprint_${project.id}`, JSON.stringify(Array.from(expandedIds)));
  }, [expandedIds, project.id]);

  // --- Scroll infrastructure ---
  useEffect(() => {
    if (!rootRef.current) return;
    const parent = rootRef.current.closest('.project-scroll') as HTMLElement | null;
    if (!parent) return;
    scrollParentRef.current = parent;

    const handleScroll = () => {
      scrollTopRef.current = parent.scrollTop;
    };

    parent.addEventListener('scroll', handleScroll, { passive: true });
    return () => parent.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    const pending = pendingScrollRestoreRef.current;
    if (pending) {
      restoreScrollSnapshot(pending);
      pendingScrollRestoreRef.current = null;
      return;
    }

    const parent = scrollParentRef.current;
    if (!parent) return;
    parent.scrollTop = scrollTopRef.current;
  }, [project.items]);

  useLayoutEffect(() => {
    const lastId = lastEditedIdRef.current;
    if (!lastId || !tableScrollRef.current) return;

    const row = tableScrollRef.current.querySelector(`[data-row-id="${lastId}"]`) as HTMLElement | null;
    if (row) {
      row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    lastEditedIdRef.current = null;
  }, [project.items]);

  const getScrollSnapshot = () => {
    const page = scrollParentRef.current;
    const table = tableScrollRef.current;
    return {
      pageTop: page?.scrollTop ?? 0,
      tableTop: table?.scrollTop ?? 0,
      tableLeft: table?.scrollLeft ?? 0,
    };
  };

  const restoreScrollSnapshot = (snapshot: { pageTop: number; tableTop: number; tableLeft: number }) => {
    const apply = () => {
      const page = scrollParentRef.current;
      const table = tableScrollRef.current;
      if (page) page.scrollTop = snapshot.pageTop;
      if (table) {
        table.scrollTop = snapshot.tableTop;
        table.scrollLeft = snapshot.tableLeft;
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        apply();
        setTimeout(apply, 0);
        setTimeout(apply, 50);
      });
    });
  };

  const preserveScroll = (action: () => void) => {
    const snapshot = getScrollSnapshot();
    pendingScrollRestoreRef.current = snapshot;
    action();
    restoreScrollSnapshot(snapshot);
  };

  // --- State helpers ---
  const updateLocalItems = (items: WorkItem[]) => {
    localItemsRef.current = items;
    setLocalItems(items);
  };

  const updateItemsState = (items: WorkItem[]) => {
    preserveScroll(() => {
      updateLocalItems(items);
      onUpdateProject({ items });
    });
  };

  // --- API sync ---
  const syncItemUpdate = async (id: string, patch: Partial<WorkItem>) => {
    const snapshot = getScrollSnapshot();
    try {
      await workItemsApi.update(id, patch);
    } catch (error) {
      console.error('Erro ao salvar item:', error);
    } finally {
      restoreScrollSnapshot(snapshot);
    }
  };

  const syncItemsBulk = async (updates: { id: string; patch: Partial<WorkItem> }[]) => {
    const snapshot = getScrollSnapshot();
    try {
      await Promise.all(updates.map(update => workItemsApi.update(update.id, update.patch)));
    } catch (error) {
      console.error('Erro ao salvar itens:', error);
    } finally {
      restoreScrollSnapshot(snapshot);
    }
  };

  // --- Collect descendants for recursive delete ---
  const collectDescendants = (items: WorkItem[], id: string) => {
    const ids = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of items) {
        if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
          ids.add(item.id);
          changed = true;
        }
      }
    }
    return ids;
  };

  // --- Tree processing with BDI ---
  const processedTree = useMemo(() => {
    const tree = treeService.buildTree<WorkItem>(localItems);
    return tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
  }, [localItems, project.bdi]);

  const allProcessedItems = useMemo(() => {
    const allIds = new Set(localItems.map(i => i.id));
    return treeService.flattenTree(processedTree, allIds);
  }, [processedTree, localItems]);

  const totalGeral = useMemo(() => {
    const itemsOnly = allProcessedItems.filter(i => i.type === 'item');
    return financial.sum(itemsOnly.map(i => i.contractTotal || 0));
  }, [allProcessedItems]);

  const averageValue = useMemo(() => {
    const itemsOnly = allProcessedItems.filter(i => i.type === 'item');
    return itemsOnly.length > 0 ? totalGeral / itemsOnly.length : 0;
  }, [totalGeral, allProcessedItems]);

  const flattenedList = useMemo(() => 
    treeService.flattenTree(processedTree, expandedIds)
  , [processedTree, expandedIds]);

  const filteredData = searchQuery.trim() 
    ? flattenedList.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.wbs.includes(searchQuery))
    : flattenedList;

  const currencySymbol = project.theme?.currencySymbol || 'R$';
  const bdiFactor = 1 + (project.bdi || 0) / 100;

  // --- Handlers ---
  const handleDragEnd = (result: DropResult) => {
    if (!canEditBlueprint || !result.destination) return;
    const sourceId = result.draggableId;
    const targetIdx = result.destination.index;
    const targetItem = filteredData[targetIdx];
    if (!targetItem) return;

    const nextItems = treeService.reorderItems<WorkItem>(localItemsRef.current, sourceId, targetItem.id, 'after');
    updateItemsState(nextItems);

    const updates = nextItems
      .map((item, index) => {
        const original = localItemsRef.current.find(o => o.id === item.id);
        if (original && original.order !== item.order) {
          return { id: item.id, patch: { order: item.order } };
        }
        return null;
      })
      .filter(Boolean) as { id: string; patch: Partial<WorkItem> }[];

    if (updates.length > 0) {
      syncItemsBulk(updates);
    }
  };

  const updateItemContractQuantity = async (id: string, qty: number) => {
    if (!canEditBlueprint) return;
    lastEditedIdRef.current = id;

    const nextItems = localItemsRef.current.map(it => {
      if (it.id === id) {
        const safeQty = Math.max(0, qty);
        const newContractTotal = financial.truncate(safeQty * it.unitPrice);
        return { 
          ...it, 
          contractQuantity: safeQty,
          contractTotal: newContractTotal,
        };
      }
      return it;
    });

    updateItemsState(nextItems);
    const updated = nextItems.find(it => it.id === id);
    if (updated) {
      await syncItemUpdate(id, { 
        contractQuantity: updated.contractQuantity,
        contractTotal: updated.contractTotal,
      });
    }
  };

  const updateItemUnitPrice = async (id: string, price: number) => {
    if (!canEditBlueprint) return;
    lastEditedIdRef.current = id;

    const nextItems = localItemsRef.current.map(it => {
      if (it.id === id) {
        const newUnitPrice = Math.max(0, price);
        // Preço digitado = com BDI; calcular unitPriceNoBdi inversamente
        const newUnitPriceNoBdi = financial.truncate(newUnitPrice / bdiFactor);
        const newContractTotal = financial.truncate(newUnitPrice * it.contractQuantity);
        return { 
          ...it, 
          unitPrice: newUnitPrice, 
          unitPriceNoBdi: newUnitPriceNoBdi,
          contractTotal: newContractTotal,
        };
      }
      return it;
    });

    updateItemsState(nextItems);
    const updated = nextItems.find(it => it.id === id);
    if (updated) {
      await syncItemUpdate(id, { 
        unitPrice: updated.unitPrice,
        unitPriceNoBdi: updated.unitPriceNoBdi,
        contractTotal: updated.contractTotal,
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!canEditBlueprint) return;
    const idsToRemove = collectDescendants(localItemsRef.current, id);
    const nextItems = localItemsRef.current.filter(item => !idsToRemove.has(item.id));
    updateItemsState(nextItems);
    try {
      await workItemsApi.remove(id);
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  return (
    <div ref={rootRef} className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Calculator size={16} className="text-blue-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{localItems.filter(i => i.type === 'item').length}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Itens</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Coins size={16} className="text-indigo-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{financial.formatVisual(averageValue, currencySymbol)}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Valor méd.</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Layers size={16} className="text-emerald-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{localItems.filter(i => i.type === 'category').length}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Categorias</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          {canEditBlueprint && (
            <button 
              onClick={() => onOpenModal('item', null, null)} 
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-indigo-500/10 hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14}/> Novo Item
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              placeholder="Buscar item..." 
              className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-2 rounded-xl text-xs outline-none focus:border-indigo-500 transition-all dark:text-white font-bold w-56"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* 2. TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div ref={tableScrollRef} className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {canEditBlueprint && <th className="p-4 w-12 text-center no-print">#</th>}
                <th className="p-4 w-20 text-center">Item</th>
                <th className="p-4 text-left min-w-[300px]">Descrição do Serviço</th>
                <th className="p-4 w-20 text-center">Und</th>
                <th className="p-4 w-32 text-center">Quantitativo</th>
                <th className="p-4 w-32 text-right">P.Unit S/BDI</th>
                <th className="p-4 w-32 text-right">P.Unit C/BDI</th>
                <th className="p-4 w-32 text-right">Total</th>
                {canEditBlueprint && <th className="p-4 w-24 text-center no-print">Ações</th>}
              </tr>
            </thead>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="blueprint-list">
                {(provided) => (
                  <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredData.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canEditBlueprint}>
                        {(provided, snapshot) => (
                          <tr 
                            ref={provided.innerRef} 
                            {...provided.draggableProps}
                            data-row-id={item.id}
                            className={`group transition-colors ${item.type === 'category' ? 'bg-slate-50/30 dark:bg-slate-800/20 font-bold' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'} ${snapshot.isDragging ? 'bg-indigo-50 dark:bg-indigo-900/20 shadow-lg' : ''}`}
                          >
                            {canEditBlueprint && (
                              <td className="p-2 text-center no-print">
                                <div {...provided.dragHandleProps} className="inline-flex p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                  <GripVertical size={14} />
                                </div>
                              </td>
                            )}
                            <td className="p-4 text-center font-mono text-[10px] text-slate-400">{item.wbs}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2" style={{ marginLeft: `${(item as any).depth * 1.5}rem` }}>
                                {item.type === 'category' ? (
                                  <button onClick={() => toggleExpand(item.id)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                    {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                ) : <div className="w-6" />}
                                {item.type === 'category' ? <Layers size={14} className="text-indigo-500 shrink-0" /> : <Package size={14} className="text-slate-300 shrink-0" />}
                                <span className={`truncate ${item.type === 'category' ? 'uppercase text-[10px] font-black text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300 font-medium'}`}>
                                  {item.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-4 text-center font-black text-slate-400 uppercase text-[9px]">{item.unit || '-'}</td>
                            <td className="p-4 text-center">
                              {item.type === 'item' ? (
                                <input 
                                  type="number" 
                                  step="any"
                                  disabled={!canEditBlueprint}
                                  className="w-20 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 border-2 focus:border-indigo-500 rounded-lg px-2 py-1 text-center text-[11px] font-bold outline-none transition-all disabled:opacity-50"
                                  value={item.contractQuantity}
                                  onChange={(e) => updateItemContractQuantity(item.id, parseFloat(e.target.value) || 0)}
                                />
                              ) : '-'}
                            </td>
                            {/* P.Unit S/BDI (read-only, calculated) */}
                            <td className="p-4 text-right text-slate-400 text-[10px]">
                              {item.type === 'item' 
                                ? financial.formatVisual(item.unitPriceNoBdi || 0, currencySymbol)
                                : '-'}
                            </td>
                            {/* P.Unit C/BDI (editable) */}
                            <td className="p-4 text-right">
                              {item.type === 'item' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-[9px] text-slate-400 font-black">{currencySymbol}</span>
                                  <input 
                                    type="text"
                                    disabled={!canEditBlueprint}
                                    className="w-24 bg-transparent text-right font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 disabled:opacity-50"
                                    value={financial.formatVisual(item.unitPrice, '').trim()}
                                    onChange={(e) => {
                                      const val = financial.parseLocaleNumber(financial.maskCurrency(e.target.value));
                                      updateItemUnitPrice(item.id, val);
                                    }}
                                  />
                                </div>
                              ) : '-'}
                            </td>
                            <td className="p-4 text-right font-black text-slate-800 dark:text-white">
                              {financial.formatVisual(item.contractTotal, currencySymbol)}
                            </td>
                            {canEditBlueprint && (
                              <td className="p-4 text-center no-print">
                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => onOpenModal(item.type, item, item.parentId)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
                                    <Edit3 size={14}/>
                                  </button>
                                  <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                                    <Trash2 size={14}/>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </DragDropContext>
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 font-black">
              <tr>
                <td colSpan={canEditBlueprint ? 7 : 6} className="p-6 text-right uppercase tracking-widest text-[10px] text-slate-400">Total Geral Estimado:</td>
                <td className="p-6 text-right text-base text-indigo-600 tracking-tighter">
                  {financial.formatVisual(totalGeral, currencySymbol)}
                </td>
                {canEditBlueprint && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
