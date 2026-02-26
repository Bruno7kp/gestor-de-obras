
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package, Plus, Search, ArrowUpCircle, ArrowDownCircle,
  History, AlertTriangle, Edit2, Trash2, GripVertical, RefreshCw,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { StockItem, StockMovementType } from '../types';
import { stockApi } from '../services/stockApi';
import { financial } from '../utils/math';
import { StockItemModal } from './StockItemModal';
import { StockMovementModal } from './StockMovementModal';
import { useToast } from '../hooks/useToast';
import { ConfirmModal } from './ConfirmModal';

interface InventoryViewProps {
  projectId: string;
  canEditModule: boolean;
  isReadOnly?: boolean;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ projectId, canEditModule, isReadOnly }) => {
  const toast = useToast();
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [activeItem, setActiveItem] = useState<StockItem | null>(null);
  const [defaultMovementType, setDefaultMovementType] = useState<StockMovementType>('entry');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StockItem | null>(null);

  const canEdit = canEditModule && !isReadOnly;

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      const items = await stockApi.list(projectId);
      setStockItems(items);
    } catch (err) {
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const filteredStock = useMemo(() => {
    return stockItems
      .filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.order - b.order);
  }, [stockItems, searchTerm]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    const items = Array.from(stockItems).sort((a, b) => a.order - b.order);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedItems = items.map((item, index) => ({ ...item, order: index }));
    setStockItems(updatedItems);

    try {
      await stockApi.reorder(
        projectId,
        updatedItems.map((it) => ({ id: it.id, order: it.order })),
      );
    } catch {
      toast.error('Erro ao reordenar');
      loadStock();
    }
  };

  const handleSaveItem = async (data: { name: string; unit: string; minQuantity: number }) => {
    try {
      if (editingItem) {
        const updated = await stockApi.update(editingItem.id, data);
        setStockItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
        toast.success('Material atualizado');
      } else {
        const created = await stockApi.create(projectId, data);
        setStockItems((prev) => [...prev, created]);
        toast.success('Material adicionado');
      }
    } catch {
      toast.error('Erro ao salvar material');
    }
    setEditingItem(null);
  };

  const handleSaveMovement = async (type: StockMovementType, quantity: number, responsible: string, notes: string) => {
    if (!activeItem) return;

    const willGoNegative = type === 'exit' && quantity > activeItem.currentQuantity;

    try {
      const updated = await stockApi.addMovement(activeItem.id, {
        type,
        quantity,
        responsible,
        notes,
      });
      setStockItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));

      if (willGoNegative) {
        toast.warning('Movimentação registrada — estoque ficou negativo');
      } else {
        toast.success(type === 'entry' ? 'Entrada registrada' : 'Saída registrada');
      }
    } catch {
      toast.error('Erro ao registrar movimentação');
    }
    setActiveItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm) return;
    try {
      await stockApi.remove(deleteConfirm.id);
      setStockItems((prev) => prev.filter((it) => it.id !== deleteConfirm.id));
      toast.success('Item removido');
    } catch {
      toast.error('Erro ao excluir item');
    }
    setDeleteConfirm(null);
  };

  const openEntry = (item: StockItem) => {
    setActiveItem(item);
    setDefaultMovementType('entry');
    setIsMovementModalOpen(true);
  };

  const openExit = (item: StockItem) => {
    setActiveItem(item);
    setDefaultMovementType('exit');
    setIsMovementModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. TOP BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl">
            <Package size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">Controle de Estoque</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1.5">Gestão de Materiais e Insumos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 border-2 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold w-64"
            />
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditingItem(null); setIsItemModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus size={16} /> Novo Item
            </button>
          )}
        </div>
      </div>

      {/* 2. INVENTORY TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="stock-list">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="divide-y divide-slate-100 dark:divide-slate-800">
                {/* Header */}
                <div className="hidden lg:grid grid-cols-[40px_1fr_120px_120px_200px] gap-4 px-8 py-4 bg-slate-50/50 dark:bg-slate-800/50 items-center">
                  <div className="w-6" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Unidade</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Saldo Atual</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</span>
                </div>

                {filteredStock.length === 0 ? (
                  <div className="p-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package size={32} className="text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                      {searchTerm ? 'Nenhum material encontrado' : 'Nenhum item no estoque'}
                    </p>
                    {!searchTerm && canEdit && (
                      <p className="text-slate-300 text-[10px] mt-2">Clique em "Novo Item" para adicionar materiais</p>
                    )}
                  </div>
                ) : (
                  filteredStock.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canEdit}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps}>
                          <div
                            className={`group grid grid-cols-1 lg:grid-cols-[40px_1fr_120px_120px_200px] gap-2 lg:gap-4 px-6 lg:px-8 py-4 items-center transition-colors ${snapshot.isDragging ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'}`}
                          >
                            <div {...provided.dragHandleProps} className="hidden lg:block text-slate-300 group-hover:text-slate-400 transition-colors">
                              {canEdit && <GripVertical size={18} />}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{item.name}</p>
                              {item.currentQuantity <= item.minQuantity && item.minQuantity > 0 && (
                                <div className="flex items-center gap-1.5 mt-1 text-amber-500">
                                  <AlertTriangle size={12} />
                                  <span className="text-[9px] font-black uppercase tracking-widest">Estoque Baixo (Mín: {financial.formatQuantity(item.minQuantity)})</span>
                                </div>
                              )}
                            </div>

                            <div className="text-center">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {item.unit}
                              </span>
                            </div>

                            <div className="text-center">
                              <span className={`text-sm font-black ${item.currentQuantity <= item.minQuantity && item.minQuantity > 0 ? 'text-amber-500' : item.currentQuantity < 0 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                {financial.formatQuantity(item.currentQuantity)}
                              </span>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => openEntry(item)}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all"
                                    title="Entrada"
                                  >
                                    <ArrowUpCircle size={18} />
                                  </button>
                                  <button
                                    onClick={() => openExit(item)}
                                    className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                    title="Saída"
                                  >
                                    <ArrowDownCircle size={18} />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setShowHistory(showHistory === item.id ? null : item.id)}
                                className={`p-2 rounded-lg transition-all ${showHistory === item.id ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                title="Histórico"
                              >
                                <History size={18} />
                              </button>
                              {canEdit && (
                                <>
                                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                                  <button
                                    onClick={() => { setEditingItem(item); setIsItemModalOpen(true); }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                                    title="Editar"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(item)}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* History Dropdown */}
                          {showHistory === item.id && (
                            <div className="mx-6 lg:mx-8 mb-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 duration-200">
                              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">Histórico Recente</h4>
                              <div className="space-y-2">
                                {(item.movements ?? []).length === 0 ? (
                                  <p className="text-center py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Nenhuma movimentação registrada</p>
                                ) : (
                                  (item.movements ?? []).slice(0, 10).map((mov) => (
                                    <div key={mov.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${mov.type === 'entry' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>
                                          {mov.type === 'entry' ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                                        </div>
                                        <div>
                                          <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                            {mov.type === 'entry' ? 'Entrada' : 'Saída'} de {financial.formatQuantity(mov.quantity)} {item.unit}
                                          </p>
                                          <p className="text-[9px] text-slate-400 font-medium">{mov.notes || 'Sem observações'}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{mov.responsible}</p>
                                        <p className="text-[9px] text-slate-400">
                                          {new Date(mov.date).toLocaleDateString('pt-BR')} {new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* Modals */}
      <StockItemModal
        isOpen={isItemModalOpen}
        onClose={() => { setIsItemModalOpen(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        editingItem={editingItem}
      />

      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => { setIsMovementModalOpen(false); setActiveItem(null); }}
        onSave={handleSaveMovement}
        item={activeItem}
        defaultType={defaultMovementType}
      />

      {deleteConfirm && (
        <ConfirmModal
          isOpen={!!deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={handleDeleteItem}
          title="Excluir Item de Estoque"
          message={`Deseja realmente excluir "${deleteConfirm.name}" e todo seu histórico de movimentações?`}
          confirmLabel="Excluir"
          variant="danger"
        />
      )}
    </div>
  );
};
