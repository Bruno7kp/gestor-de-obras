
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Project, WorkItem, ItemType } from '../types';
import { treeService } from '../services/treeService';
import { financial } from '../utils/math';
import { workItemsApi } from '../services/workItemsApi';
import { excelService, ImportResult } from '../services/excelService';
import { usePermissions } from '../hooks/usePermissions';
import { 
  Plus, Layers, Search, Package, ChevronRight, ChevronDown, 
  Edit3, Trash2, GripVertical, Calculator, Coins, Eye,
  FileSpreadsheet, UploadCloud, Download,
  Maximize2, Minimize2, Maximize, Minimize
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ConfirmModal } from './ConfirmModal';

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState<{ sent: number; total: number }>({ sent: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    return tree.map((root, idx) => treeService.processRecursive(root, '', idx, 0));
  }, [localItems]);

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

  // --- View mode ---
  type BlueprintViewMode = 'full' | 'quantity' | 'price';
  const viewModeKey = `blueprint_view_${project.id}`;
  const [viewMode, setViewMode] = useState<BlueprintViewMode>(() => {
    const saved = localStorage.getItem(viewModeKey);
    return (saved === 'quantity' || saved === 'price') ? saved : 'full';
  });
  const showQuantity = viewMode !== 'price';
  const showPrice = viewMode !== 'quantity';
  const handleViewModeChange = (mode: BlueprintViewMode) => {
    setViewMode(mode);
    localStorage.setItem(viewModeKey, mode);
  };

  // --- Fullscreen ---
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- Expand / Collapse all ---
  const expandAll = () => setExpandedIds(new Set<string>(localItemsRef.current.filter(i => i.type === 'category').map(i => i.id)));
  const collapseAll = () => setExpandedIds(new Set<string>());

  // --- Import / Export handlers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await excelService.parseBlueprintExcel(file);
      setImportSummary(result);
    } catch {
      // toast handled elsewhere
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!importSummary) return;
    setIsImporting(true);
    setImportProgress({ sent: 0, total: importSummary.items.length });
    try {
      const itemsById = new Map(importSummary.items.map(i => [i.id, i] as const));
      const depthMap = new Map<string, number>();
      const computeDepth = (id: string, visited = new Set<string>()): number => {
        if (depthMap.has(id)) return depthMap.get(id)!;
        if (visited.has(id)) return 0;
        visited.add(id);
        const item = itemsById.get(id);
        if (!item || !item.parentId) return 0;
        const d = 1 + (item.parentId && itemsById.has(item.parentId) ? computeDepth(item.parentId, visited) : 0);
        depthMap.set(id, d);
        return d;
      };
      for (const it of importSummary.items) computeDepth(it.id);
      const sorted = [...importSummary.items].sort((a, b) => (depthMap.get(a.id) || 0) - (depthMap.get(b.id) || 0));

      const CHUNK_SIZE = 100;
      let sent = 0;
      for (let i = 0; i < sorted.length; i += CHUNK_SIZE) {
        const chunk = sorted.slice(i, i + CHUNK_SIZE);
        await workItemsApi.batch(project.id, chunk, i === 0, 'quantitativo');
        sent += chunk.length;
        setImportProgress({ sent, total: sorted.length });
      }

      onUpdateProject({ items: importSummary.items });
      setImportSummary(null);
    } catch (error) {
      console.error('Erro ao importar quantitativos:', error);
    } finally {
      setIsImporting(false);
      setImportProgress({ sent: 0, total: 0 });
    }
  };

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
        const newUnitPriceNoBdi = Math.max(0, price);
        // Quantitativos: P.Unit = unitPriceNoBdi, sem BDI; unitPrice = unitPriceNoBdi
        const newContractTotal = financial.truncate(newUnitPriceNoBdi * it.contractQuantity);
        return { 
          ...it, 
          unitPrice: newUnitPriceNoBdi, 
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

  // --- Count visible columns for footer colSpan ---
  const baseColCount = 3 + (canEditBlueprint ? 2 : 0); // drag handle + Item + Descrição + Und + Ações
  const dataColCount = (showQuantity ? 1 : 0) + (showPrice ? 2 : 0); // Qtd + P.Unit + Total
  const totalColCount = baseColCount + dataColCount;

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      {/* 1. KPI HEADER */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Calculator size={16} className="text-blue-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{localItems.filter(i => i.type === 'item').length}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Itens</p>
          </div>
        </div>
        {showPrice && (
          <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Coins size={16} className="text-indigo-500" />
            <div className="leading-tight">
              <p className="text-sm font-black text-slate-800 dark:text-white whitespace-nowrap">{financial.formatVisual(averageValue, currencySymbol)}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Valor méd.</p>
            </div>
          </div>
        )}
        <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Layers size={16} className="text-emerald-500" />
          <div className="leading-tight">
            <p className="text-sm font-black text-slate-800 dark:text-white">{localItems.filter(i => i.type === 'category').length}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Categorias</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <input type="file" ref={fileInputRef} className="hidden" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
          <button type="button" onClick={() => excelService.downloadBlueprintTemplate()} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Download Template Excel">
            <FileSpreadsheet size={14}/>
          </button>
          {canEditBlueprint && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors" title="Importar de Excel" disabled={isImporting}>
              {isImporting ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={14}/>}
            </button>
          )}
          <button type="button" onClick={() => excelService.exportBlueprintToExcel(project, localItems)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Exportar para Excel">
            <Download size={14}/>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input 
              placeholder="Buscar..." 
              className="bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-2 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white font-bold w-40 border border-slate-200 dark:border-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
          {canEditBlueprint && (
            <button 
              onClick={() => onOpenModal('item', null, null)} 
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-indigo-500/10 hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14}/> Novo Item
            </button>
          )}
        </div>
      </div>

      {/* Import summary */}
      {importSummary && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
          <h3 className="font-black text-emerald-800 dark:text-emerald-200 text-sm mb-2">Resumo da importação (Quantitativo)</h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">{importSummary.stats.categories} categorias e {importSummary.stats.items} itens encontrados.</p>
          {importSummary.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc list-inside">{importSummary.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
          )}
          {importProgress.total > 0 && (
            <div className="mt-3">
              <div className="h-2 bg-emerald-200 dark:bg-emerald-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all rounded-full" style={{ width: `${Math.round(importProgress.sent / importProgress.total * 100)}%` }} />
              </div>
              <p className="text-[10px] text-emerald-600 mt-1">{importProgress.sent}/{importProgress.total} itens enviados</p>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={confirmImport} disabled={isImporting} className="px-4 py-2 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 disabled:opacity-50">
              {isImporting ? 'Importando...' : 'Confirmar importação'}
            </button>
            <button onClick={() => setImportSummary(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* 2. TOOLBAR (same pattern as EAP) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <Maximize2 size={12} /> <span className="hidden xs:inline">Expandir</span>
          </button>
          <button onClick={collapseAll} className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <Minimize2 size={12} /> <span className="hidden xs:inline">Recolher</span>
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen();
                return;
              }
              const target = tableScrollRef.current?.closest('.project-fullscreen') as HTMLElement | null;
              if (target) {
                void target.requestFullscreen();
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:text-blue-600 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm"
            title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
            type="button"
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
            <span className="hidden xs:inline">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
          </button>

        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="px-3 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-r border-slate-200 dark:border-slate-700 mr-1">
            <Eye size={12}/> Visão:
          </div>
          {([['full', 'Completo'], ['quantity', 'Quantitativo'], ['price', 'Preço']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => handleViewModeChange(mode)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                viewMode === mode
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}

        </div>
      </div>

      {/* 3. TABLE */}
      <div
        ref={tableScrollRef}
        className={`overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 shadow-xl custom-scrollbar ${isFullscreen ? 'max-h-[78vh]' : 'max-h-[74vh]'}`}
        style={{ overflowAnchor: 'none' }}
      >
        <DragDropContext onDragEnd={handleDragEnd}>
          <table className="min-w-max w-full border-separate border-spacing-0 text-[11px]">
            <thead className="bg-slate-900 dark:bg-black text-white sticky top-0 z-30">
              <tr className="text-[9px] font-black uppercase tracking-widest opacity-80 text-center">
                {canEditBlueprint && <th className="p-3 border-r border-slate-800 dark:border-slate-900 w-10 no-print">Mover</th>}
                {canEditBlueprint && <th className="p-4 border-r border-slate-800 dark:border-slate-900 w-24 no-print">Ações</th>}
                <th className="p-4 border-r border-slate-800 dark:border-slate-900 w-16">Item</th>
                <th className="p-4 border-r border-slate-800 dark:border-slate-900 text-left w-[400px] min-w-[300px] max-w-[400px]">Descrição do Serviço</th>
                <th className="p-4 border-r border-slate-800 dark:border-slate-900 w-14">Und</th>
                {showQuantity && <th className="p-4 border-r border-slate-800 dark:border-slate-900 w-24">Qtd</th>}
                {showPrice && <th className="p-4 border-r border-slate-800 dark:border-slate-900 w-32 text-right">P.Unit ({currencySymbol})</th>}
                {showPrice && <th className="p-4 w-32 text-right">Total</th>}
              </tr>
            </thead>
            <Droppable droppableId="blueprint-list" direction="vertical" isDropDisabled={!canEditBlueprint}>
              {(provided) => (
                <tbody {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canEditBlueprint}>
                      {(provided, snapshot) => (
                        <tr 
                          ref={provided.innerRef} 
                          {...provided.draggableProps}
                          data-row-id={item.id}
                          className={`group transition-colors ${item.type === 'category' ? 'bg-slate-50/50 dark:bg-slate-800/30 font-bold' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'} ${snapshot.isDragging ? 'bg-indigo-50 dark:bg-indigo-900/20 shadow-lg' : ''}`}
                        >
                          {canEditBlueprint && (
                            <td className="p-2 text-center no-print border-r border-slate-100 dark:border-slate-800">
                              <div {...provided.dragHandleProps} className="inline-flex p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing">
                                <GripVertical size={14} />
                              </div>
                            </td>
                          )}
                          {canEditBlueprint && (
                            <td className="p-3 text-center no-print border-r border-slate-100 dark:border-slate-800">
                              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onOpenModal(item.type, item, item.parentId)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all">
                                  <Edit3 size={14}/>
                                </button>
                                <button onClick={() => setConfirmDeleteId(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                                  <Trash2 size={14}/>
                                </button>
                              </div>
                            </td>
                          )}
                          <td className="p-3 text-center font-mono text-[10px] text-slate-400 border-r border-slate-100 dark:border-slate-800">{item.wbs}</td>
                          <td className="p-3 max-w-[400px] border-r border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2" style={{ marginLeft: `${(item as any).depth * 1.5}rem` }}>
                              {item.type === 'category' ? (
                                <button onClick={() => toggleExpand(item.id)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                  {expandedIds.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                              ) : <div className="w-6" />}
                              {item.type === 'category' ? <Layers size={14} className="text-indigo-500 shrink-0" /> : <Package size={14} className="text-slate-300 shrink-0" />}
                              <span 
                                className={`truncate max-w-[320px] ${item.type === 'category' ? 'uppercase text-[10px] font-black text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300 font-medium'}`}
                                title={item.name}
                              >
                                {item.name}
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center font-black text-slate-400 uppercase text-[9px] border-r border-slate-100 dark:border-slate-800">{item.unit || '-'}</td>
                          {showQuantity && (
                            <td className="p-3 text-center border-r border-slate-100 dark:border-slate-800">
                              {item.type === 'item' ? (
                                <input 
                                  type="number" 
                                  step="any"
                                  disabled={!canEditBlueprint}
                                  className="w-20 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded px-2 py-0.5 text-center text-[10px] font-bold outline-none transition-all disabled:opacity-50"
                                  value={item.contractQuantity}
                                  onChange={(e) => updateItemContractQuantity(item.id, parseFloat(e.target.value) || 0)}
                                />
                              ) : '-'}
                            </td>
                          )}
                          {showPrice && (
                            <td className="p-3 text-right border-r border-slate-100 dark:border-slate-800">
                              {item.type === 'item' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <input 
                                    type="text"
                                    disabled={!canEditBlueprint}
                                    className="w-24 bg-transparent text-right font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1 disabled:opacity-50"
                                    value={financial.formatVisual(item.unitPriceNoBdi || 0, '').trim()}
                                    onChange={(e) => {
                                      const val = financial.parseLocaleNumber(financial.maskCurrency(e.target.value));
                                      updateItemUnitPrice(item.id, val);
                                    }}
                                  />
                                  <span className="text-[9px] text-slate-400 font-black">{currencySymbol}</span>
                                </div>
                              ) : '-'}
                            </td>
                          )}
                          {showPrice && (
                            <td className="p-3 text-right font-black text-slate-800 dark:text-white whitespace-nowrap">
                              {financial.formatVisual(item.contractTotal, currencySymbol)}
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

            {showPrice && (
              <tfoot className="bg-slate-950 dark:bg-black text-white font-black text-xs sticky bottom-0 z-40 shadow-2xl">
                <tr className="border-t border-slate-800 dark:border-slate-900">
                  <td colSpan={totalColCount - 1} className="p-5 text-right uppercase tracking-[0.2em] text-[10px] border-r border-slate-800 dark:border-slate-900">Consolidado Total:</td>
                  <td className="p-5 text-right text-base tracking-tighter whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[10px] text-slate-400 font-black">{currencySymbol}</span>
                      <span>{financial.formatVisual(totalGeral, '').trim()}</span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </DragDropContext>
      </div>
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir item do Quantitativo"
        message={(() => {
          if (!confirmDeleteId) return 'Deseja realmente excluir este item?';
          const target = localItemsRef.current.find(item => item.id === confirmDeleteId);
          const idsToRemove = collectDescendants(localItemsRef.current, confirmDeleteId);
          const count = idsToRemove.size;
          const name = target?.name ? `"${target.name}"` : 'este item';
          if (count > 1) {
            return `Deseja realmente excluir ${name}? ${count - 1} itens abaixo também serão removidos.`;
          }
          return `Deseja realmente excluir ${name}?`;
        })()}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          const deleteId = confirmDeleteId;
          setConfirmDeleteId(null);
          await handleDeleteItem(deleteId);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
