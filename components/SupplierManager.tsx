
import React, { useState, useMemo, useEffect } from 'react';
import { Supplier } from '../types';
import { 
  Truck, Search, Plus, Star, Phone, Mail, 
  Trash2, Edit2, GripVertical, Building2, Filter,
  ExternalLink, MessageCircle, AlertCircle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SupplierModal } from './SupplierModal';
import { ConfirmModal } from './ConfirmModal';
import { suppliersApi } from '../services/suppliersApi';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface SupplierManagerProps {
  suppliers: Supplier[];
  onUpdateSuppliers: (list: Supplier[]) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, onUpdateSuppliers }) => {
  const { getLevel } = usePermissions();
  const canEditSuppliers = getLevel('suppliers') === 'edit';
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | Supplier['category']>(() => {
    const saved = localStorage.getItem('suppliers_filter');
    return saved === 'ALL' || saved === 'Material' || saved === 'Serviço' || saved === 'Locação'
      ? (saved as 'ALL' | Supplier['category'])
      : 'ALL';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                             s.cnpj.includes(search);
        const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.order - b.order);
  }, [suppliers, search, categoryFilter]);

  useEffect(() => {
    localStorage.setItem('suppliers_filter', categoryFilter);
  }, [categoryFilter]);

  const stats = useMemo(() => {
    return {
      total: suppliers.length,
      topRated: suppliers.filter(s => s.rating >= 4).length,
      byCategory: {
        Material: suppliers.filter(s => s.category === 'Material').length,
        Serviço: suppliers.filter(s => s.category === 'Serviço').length,
      }
    };
  }, [suppliers]);

  // Fix: Explicitly ensure mapped items are treated as object types for spread operation
  const handleDragEnd = async (result: DropResult) => {
    if (!canEditSuppliers) return;
    if (!result.destination) return;
    const previous = suppliers;
    const items = Array.from(suppliers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    
    if (reorderedItem) {
      items.splice(result.destination.index, 0, reorderedItem);
      // Fixed: Casting item to Supplier to satisfy "Spread types may only be created from object types" check
      const updated = items.map((item, index) => ({ ...(item as Supplier), order: index }));
      onUpdateSuppliers(updated);
      const changed = updated.filter((item) => item.order !== previous.find((p) => p.id === item.id)?.order);

      try {
        await Promise.all(changed.map((item) => suppliersApi.update(item.id, { order: item.order })));
      } catch (error) {
        console.error('Erro ao reordenar fornecedores:', error);
        onUpdateSuppliers(previous);
      }
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    const previous = suppliers;
    onUpdateSuppliers(suppliers.filter(s => s.id !== id));
    try {
      await suppliersApi.remove(id);
      toast.success('Fornecedor removido com sucesso.');
    } catch (error) {
      console.error('Erro ao remover fornecedor:', error);
      onUpdateSuppliers(previous);
      toast.error('Erro ao remover fornecedor.');
    }
  };

  const handleSave = async (data: Partial<Supplier>) => {
    if (editingSupplier) {
      // Fix: Capture ID in a local variable to maintain narrowing inside map callback
      const targetId = editingSupplier.id;
      const previous = suppliers;
      const updatedList = suppliers.map(s => s.id === targetId ? { ...s, ...data } : s);
      onUpdateSuppliers(updatedList);
      try {
        const updated = await suppliersApi.update(targetId, data);
        onUpdateSuppliers(updatedList.map((item) => (item.id === targetId ? updated : item)));
      } catch (error) {
        console.error('Erro ao atualizar fornecedor:', error);
        onUpdateSuppliers(previous);
      }
    } else {
      // Fix: Simplified assignment and removed redundant casting
      const newSupplier: Supplier = {
        id: crypto.randomUUID(),
        name: data.name || 'Novo Fornecedor',
        cnpj: data.cnpj || '',
        contactName: data.contactName || '',
        email: data.email || '',
        phone: data.phone || '',
        category: data.category || 'Material',
        rating: data.rating || 0,
        notes: data.notes || '',
        order: suppliers.length,
      };
      const nextSuppliers = [...suppliers, newSupplier];
      onUpdateSuppliers(nextSuppliers);
      try {
        const created = await suppliersApi.create({
          name: newSupplier.name,
          cnpj: newSupplier.cnpj,
          contactName: newSupplier.contactName,
          email: newSupplier.email,
          phone: newSupplier.phone,
          category: newSupplier.category,
          rating: newSupplier.rating,
          notes: newSupplier.notes,
          order: newSupplier.order,
        });
        onUpdateSuppliers(nextSuppliers.map((item) => (item.id === newSupplier.id ? created : item)));
      } catch (error) {
        console.error('Erro ao criar fornecedor:', error);
      }
    }
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Gestão de Fornecedores</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Parceiros comerciais e base de suprimentos.</p>
          </div>
          <button 
            onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }}
            className={`flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all ${!canEditSuppliers && 'hidden'}`}
          >
            <Plus size={18} /> Novo Parceiro
          </button>
        </div>

        {/* STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="Total Cadastrados" value={stats.total} icon={<Truck />} color="indigo" />
          <StatCard label="Qualificação Alta (4★+)" value={stats.topRated} icon={<Star />} color="amber" />
          <StatCard label="Materiais / Serviços" value={`${stats.byCategory.Material} / ${stats.byCategory.Serviço}`} icon={<Building2 />} color="emerald" />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              placeholder="Buscar por nome, CNPJ ou categoria..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 overflow-x-auto no-scrollbar w-full md:w-auto">
             {(['ALL', 'Material', 'Serviço', 'Locação'] as const).map(cat => (
               <button 
                 key={cat}
                 onClick={() => setCategoryFilter(cat)}
                 className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 {cat === 'ALL' ? 'Tudo' : cat}
               </button>
             ))}
          </div>
        </div>

        {/* LISTA DRAG & DROP */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="suppliers-list">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-4"
              >
                {filteredSuppliers.map((supplier, index) => (
                  <Draggable key={supplier.id} draggableId={supplier.id} index={index}>
                    {(p, snapshot) => (
                      <div
                        ref={p.innerRef}
                        {...p.draggableProps}
                        className={`bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 group ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-indigo-500 z-50' : ''}`}
                      >
                        <div className="flex items-center gap-5">
                          <div {...p.dragHandleProps} className={`p-1 text-slate-300 hover:text-indigo-500 transition-colors cursor-grab active:cursor-grabbing ${!canEditSuppliers && 'invisible'}`}>
                            <GripVertical size={20} />
                          </div>
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${getCategoryColor(supplier.category)}`}>
                            {supplier.category === 'Material' ? <Truck size={24} /> : <Building2 size={24} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-base font-black dark:text-white uppercase tracking-tight">{supplier.name}</h3>
                              <RatingStars rating={supplier.rating} />
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{supplier.cnpj} • {supplier.category}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-8">
                          <div className="space-y-1">
                             <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                               <Phone size={14} className="text-slate-400" /> {supplier.phone || 'N/A'}
                             </div>
                             <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                               <Mail size={14} className="text-slate-400" /> {supplier.email || 'N/A'}
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                             {canEditSuppliers && (
                               <button 
                                 onClick={() => { setEditingSupplier(supplier); setIsModalOpen(true); }}
                                 className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                               >
                                 <Edit2 size={18} />
                               </button>
                             )}
                             {canEditSuppliers && (
                               <button 
                                 onClick={() => setConfirmDeleteId(supplier.id)}
                                 className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                               >
                                 <Trash2 size={18} />
                               </button>
                             )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                {filteredSuppliers.length === 0 && (
                  <div className="py-20 text-center opacity-30 select-none">
                    <Truck size={64} className="mx-auto mb-4" />
                    <p className="text-sm font-black uppercase tracking-widest">Nenhum fornecedor encontrado</p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <SupplierModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        supplier={editingSupplier}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Excluir fornecedor"
        message={`Deseja realmente excluir este fornecedor? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
    emerald: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className={`text-xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{value}</p>
    </div>
  );
};

const getCategoryColor = (category: Supplier['category']) => {
  switch (category) {
    case 'Material': return 'bg-indigo-600';
    case 'Serviço': return 'bg-blue-600';
    case 'Locação': return 'bg-amber-600';
    default: return 'bg-slate-600';
  }
};

const RatingStars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(s => (
      <Star key={s} size={12} className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-800'} />
    ))}
  </div>
);
