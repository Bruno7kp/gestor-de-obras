
import React, { useState, useMemo, useEffect } from 'react';
import { Project, Supplier } from '../types';
import { 
  Truck, Search, Plus, Phone, Mail,
  Trash2, Edit2, GripVertical, Building2, Filter,
  Boxes, Download, UploadCloud, X, Loader2
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SupplierModal } from './SupplierModal';
import { ConfirmModal } from './ConfirmModal';
import { suppliersApi } from '../services/suppliersApi';
import { projectsApi } from '../services/projectsApi';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';
import { uiPreferences } from '../utils/uiPreferences';
import { excelService } from '../services/excelService';
import { financial } from '../utils/math';

interface SupplierManagerProps {
  suppliers: Supplier[];
  projects: Project[];
  onUpdateSuppliers: (list: Supplier[]) => void;
}

export const SupplierManager: React.FC<SupplierManagerProps> = ({ suppliers, projects, onUpdateSuppliers }) => {
  const { getLevel } = usePermissions();
  const canEditSuppliers = getLevel('suppliers') === 'edit';
  const toast = useToast();
  const [search, setSearch] = useState('');
  const supplierFilterKey = 'suppliers_filter';
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | Supplier['category']>(() => {
    const saved = uiPreferences.getString(supplierFilterKey);
    return saved === 'ALL' || saved === 'Material' || saved === 'Serviço' || saved === 'Locação'
      ? (saved as 'ALL' | Supplier['category'])
      : 'ALL';
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [supplierSuppliesModal, setSupplierSuppliesModal] = useState<Supplier | null>(null);
  const [projectsForSupplies, setProjectsForSupplies] = useState<Project[]>(projects);
  const [isLoadingSuppliesProjects, setIsLoadingSuppliesProjects] = useState(false);
  const [hasLoadedSuppliesProjects, setHasLoadedSuppliesProjects] = useState(false);
  const [suppliesSearch, setSuppliesSearch] = useState('');
  const [suppliesProjectFilter, setSuppliesProjectFilter] = useState<string>('ALL');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const ensureDetailedProjectsLoaded = async () => {
    if (hasLoadedSuppliesProjects || isLoadingSuppliesProjects || projects.length === 0) return;

    setIsLoadingSuppliesProjects(true);
    try {
      const detailedProjects = await Promise.all(
        projects.map(async (project) => {
          try {
            return await projectsApi.get(project.id);
          } catch (error) {
            console.error(`Erro ao carregar dados completos da obra ${project.id}:`, error);
            return project;
          }
        }),
      );
      setProjectsForSupplies(detailedProjects);
      setHasLoadedSuppliesProjects(true);
    } finally {
      setIsLoadingSuppliesProjects(false);
    }
  };

  useEffect(() => {
    setProjectsForSupplies(projects);
    setHasLoadedSuppliesProjects(false);
  }, [projects]);

  useEffect(() => {
    void ensureDetailedProjectsLoaded();
  }, [projects]);

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
    uiPreferences.setString(supplierFilterKey, categoryFilter);
  }, [categoryFilter, supplierFilterKey]);

  const stats = useMemo(() => {
    const linkedSupplies = projectsForSupplies.reduce((acc, project) => {
      return acc + project.planning.forecasts.filter((forecast) => !!forecast.supplierId).length;
    }, 0);

    return {
      total: suppliers.length,
      linkedSupplies,
      byCategory: {
        Material: suppliers.filter(s => s.category === 'Material').length,
        Serviço: suppliers.filter(s => s.category === 'Serviço').length,
      }
    };
  }, [suppliers, projectsForSupplies]);

  const supplierSupplies = useMemo(() => {
    if (!supplierSuppliesModal) return [];

    return projectsForSupplies.flatMap((project) =>
      project.planning.forecasts
        .filter((forecast) => forecast.supplierId === supplierSuppliesModal.id)
        .sort((a, b) => a.order - b.order)
        .map((forecast) => ({
          id: forecast.id,
          projectId: project.id,
          projectName: project.name,
          description: forecast.description,
          unit: forecast.unit,
          quantityNeeded: forecast.quantityNeeded,
          unitPrice: forecast.unitPrice,
          totalValue: Math.max(0, ((forecast.quantityNeeded || 0) * (forecast.unitPrice || 0)) - (forecast.discountValue || 0)),
          status: forecast.status,
          estimatedDate: forecast.estimatedDate,
        })),
    );
  }, [projectsForSupplies, supplierSuppliesModal]);

  const filteredSupplierSupplies = useMemo(() => {
    return supplierSupplies.filter((item) => {
      const matchesSearch = item.description.toLowerCase().includes(suppliesSearch.toLowerCase());
      const matchesProject = suppliesProjectFilter === 'ALL' || item.projectId === suppliesProjectFilter;
      return matchesSearch && matchesProject;
    });
  }, [supplierSupplies, suppliesSearch, suppliesProjectFilter]);

  const linkedProjects = useMemo(() => {
    const map = new Map<string, string>();
    supplierSupplies.forEach((item) => {
      map.set(item.projectId, item.projectName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [supplierSupplies]);

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
        await suppliersApi.batchReorder(changed.map((item) => ({ id: item.id, order: item.order })));
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
      const updatedList = suppliers.map(s => s.id === targetId ? { ...s, ...data, rating: s.rating ?? 0 } : s);
      onUpdateSuppliers(updatedList);
      try {
        const updated = await suppliersApi.update(targetId, { ...data, rating: editingSupplier.rating ?? 0 });
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
        rating: 0,
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
          rating: 0,
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

  const handleImportSuppliers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canEditSuppliers) return;

    try {
      const result = await excelService.parseSuppliersExcel(file);
      if (result.suppliers.length === 0) {
        toast.warning('Nenhum fornecedor válido encontrado no arquivo.');
        return;
      }

      await Promise.all(
        result.suppliers.map((supplier, index) =>
          suppliersApi.create({
            name: supplier.name,
            cnpj: supplier.cnpj,
            contactName: supplier.contactName,
            email: supplier.email,
            phone: supplier.phone,
            category: supplier.category,
            rating: 0,
            notes: supplier.notes,
            order: suppliers.length + index,
          }),
        ),
      );

      const refreshed = await suppliersApi.list();
      onUpdateSuppliers(refreshed);
      toast.success(`${result.suppliers.length} fornecedor(es) importado(s) com sucesso.`);

      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} linha(s) foram ignoradas por falta de nome.`);
      }
    } catch (error) {
      console.error('Erro ao importar fornecedores:', error);
      toast.error('Erro ao importar fornecedores.');
    }
  };

  const handleExportSuppliers = () => {
    excelService.exportSuppliersToExcel(suppliers);
  };

  const openSupplierSuppliesModal = async (supplier: Supplier) => {
    setSupplierSuppliesModal(supplier);
    setSuppliesSearch('');
    setSuppliesProjectFilter('ALL');

    await ensureDetailedProjectsLoaded();
  };

  const statusLabel: Record<string, string> = {
    pending: 'Pendente',
    ordered: 'Pedido Efetuado',
    delivered: 'Entregue',
  };

  const formatLinkedDate = (value: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-12 animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 custom-scrollbar">
      <div className="max-w-6xl mx-auto space-y-10">
        <input type="file" ref={fileInputRef} className="hidden" hidden accept=".xlsx, .xls" onChange={handleImportSuppliers} />
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Gestão de Fornecedores</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Parceiros comerciais e base de suprimentos.</p>
          </div>
          <div className="flex items-center gap-2">
            {canEditSuppliers && (
              <>
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-emerald-600" title="Importar Excel"><UploadCloud size={18} /></button>
                <button onClick={handleExportSuppliers} className="p-2.5 text-slate-400 hover:text-blue-600" title="Exportar Excel"><Download size={18} /></button>
              </>
            )}
            <button 
              onClick={() => { setEditingSupplier(null); setIsModalOpen(true); }}
              className={`flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all ${!canEditSuppliers && 'hidden'}`}
            >
              <Plus size={18} /> Novo Parceiro
            </button>
          </div>
        </div>

        {/* STATS GRID + SEARCH & FILTERS */}
        <div className="flex flex-wrap items-stretch gap-3">
          <StatCard label="Total Cadastrados" value={stats.total} icon={<Truck size={16} />} color="indigo" />
          <StatCard label="Suprimentos Vinculados" value={stats.linkedSupplies} icon={<Boxes size={16} />} color="amber" />
          <StatCard label="Materiais / Serviços" value={`${stats.byCategory.Material} / ${stats.byCategory.Serviço}`} icon={<Building2 size={16} />} color="emerald" />
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="Buscar fornecedor..."
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-700 border-2 focus:border-indigo-500 rounded-xl outline-none transition-all text-xs font-bold w-48"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg shrink-0 overflow-x-auto no-scrollbar">
              {(['ALL', 'Material', 'Serviço', 'Locação'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${categoryFilter === cat ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {cat === 'ALL' ? 'Tudo' : cat}
                </button>
              ))}
            </div>
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
                             <button
                               onClick={() => openSupplierSuppliesModal(supplier)}
                               className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                               title="Ver suprimentos vinculados"
                             >
                               <Boxes size={18} />
                             </button>
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

      {supplierSuppliesModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={() => setSupplierSuppliesModal(null)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Suprimentos vinculados</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{supplierSuppliesModal.name} • {filteredSupplierSupplies.length} item(ns)</p>
              </div>
              <button onClick={() => setSupplierSuppliesModal(null)} className="p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"><X size={20} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={suppliesSearch}
                  onChange={(e) => setSuppliesSearch(e.target.value)}
                  placeholder="Buscar suprimento..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <select
                value={suppliesProjectFilter}
                onChange={(e) => setSuppliesProjectFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none"
              >
                <option value="ALL">Todas as obras</option>
                {linkedProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </div>

            {isLoadingSuppliesProjects ? (
              <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando suprimentos...
              </div>
            ) : filteredSupplierSupplies.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                Nenhum suprimento associado a este fornecedor.
              </div>
            ) : (
              <div className="max-h-[52vh] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {filteredSupplierSupplies.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 bg-slate-50/70 dark:bg-slate-900/70">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-100">{item.description}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{item.projectName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{financial.formatVisual(item.totalValue)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{statusLabel[item.status] || item.status}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex flex-wrap gap-3">
                      <span>Qtd: {financial.formatQuantity(item.quantityNeeded)} {item.unit}</span>
                      <span>Unit: {financial.formatVisual(item.unitPrice)}</span>
                      <span>Prev: {formatLinkedDate(item.estimatedDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon, color }: any) => {
  const colors: any = {
    indigo: 'text-indigo-500',
    amber: 'text-amber-500',
    emerald: 'text-emerald-500',
  };
  const c = colors[color] ?? colors.indigo;
  return (
    <div className="flex-1 flex items-center gap-2.5 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className={c}>{icon}</div>
      <div className="leading-tight">
        <p className="text-sm font-black text-slate-800 dark:text-white">{value}</p>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      </div>
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
