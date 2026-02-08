
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, PlanningTask, MaterialForecast, Milestone, WorkItem, TaskStatus, ProjectPlanning, ProjectExpense, Supplier } from '../types';
import { planningApi } from '../services/planningApi';
import { planningService } from '../services/planningService';
import { excelService } from '../services/excelService';
import { financial } from '../utils/math';
import { 
  CheckCircle2, Circle, Clock, Package, Flag, Plus, 
  Trash2, Calendar, AlertCircle, ShoppingCart, Truck, Search,
  Wand2, ArrowUpRight, Ban, ListChecks, Boxes, Target,
  GripVertical, MoreVertical, Edit2, X, Save, Calculator, Wallet, Link,
  ChevronUp, ChevronDown, List, CalendarDays, Filter, Users, Download, UploadCloud,
  Layers, FlagTriangleRight, Printer, CreditCard, ChevronLeft, ChevronRight,
  HardHat, Building2, User, FolderTree, FileCheck, ReceiptText, FileText, FileSpreadsheet,
  ArrowRight, Lock
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ExpenseAttachmentZone } from './ExpenseAttachmentZone';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../hooks/useToast';

interface PlanningViewProps {
  project: Project;
  suppliers: Supplier[];
  onUpdatePlanning: (planning: ProjectPlanning) => void;
  onAddExpense: (expense: ProjectExpense) => void;
  categories: WorkItem[];
  allWorkItems: WorkItem[];
  viewMode?: 'planning' | 'supplies';
}

export const PlanningView: React.FC<PlanningViewProps> = ({ 
  project, suppliers, onUpdatePlanning, onAddExpense, categories, allWorkItems, viewMode = 'planning'
}) => {
  const { canEdit, getLevel } = usePermissions();
  const toast = useToast();
  const isSuppliesView = viewMode === 'supplies';
  const canEditPlanning = isSuppliesView ? canEdit('supplies') : canEdit('planning');

  const planningSubTabs: Array<'tasks' | 'forecast' | 'milestones'> = ['tasks', 'forecast', 'milestones'];
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'forecast' | 'milestones'>(() => {
    if (isSuppliesView) return 'forecast';
    const saved = localStorage.getItem(`planning_subtab_${project.id}`);
    return saved && planningSubTabs.includes(saved as 'tasks' | 'forecast' | 'milestones')
      ? (saved as 'tasks' | 'forecast' | 'milestones')
      : 'tasks';
  });
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
  const [confirmingForecast, setConfirmingForecast] = useState<MaterialForecast | null>(null);
  const [isAddingForecast, setIsAddingForecast] = useState(false);
  const [editingForecast, setEditingForecast] = useState<MaterialForecast | null>(null);
  const [isDeletingForecast, setIsDeletingForecast] = useState<MaterialForecast | null>(null);
  const [isAddingTask, setIsAddingTask] = useState<TaskStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [milestoneView, setMilestoneView] = useState<'list' | 'calendar'>('list');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastStatusFilter, setForecastStatusFilter] = useState<'pending' | 'ordered' | 'delivered'>(() => {
    const saved = localStorage.getItem(`supplies_status_${project.id}`);
    return saved === 'pending' || saved === 'ordered' || saved === 'delivered' ? saved : 'pending';
  });
  
  const planning = project.planning;

  useEffect(() => {
    if (isSuppliesView) {
      setActiveSubTab('forecast');
      const saved = localStorage.getItem(`supplies_status_${project.id}`);
      if (saved === 'pending' || saved === 'ordered' || saved === 'delivered') {
        setForecastStatusFilter(saved);
      } else {
        setForecastStatusFilter('pending');
      }
      return;
    }

    const saved = localStorage.getItem(`planning_subtab_${project.id}`);
    if (saved && planningSubTabs.includes(saved as 'tasks' | 'forecast' | 'milestones')) {
      setActiveSubTab(saved as 'tasks' | 'forecast' | 'milestones');
    } else {
      setActiveSubTab('tasks');
    }
  }, [isSuppliesView, project.id]);

  useEffect(() => {
    if (isSuppliesView) return;
    localStorage.setItem(`planning_subtab_${project.id}`, activeSubTab);
  }, [activeSubTab, isSuppliesView, project.id]);

  useEffect(() => {
    if (!isSuppliesView) return;
    localStorage.setItem(`supplies_status_${project.id}`, forecastStatusFilter);
  }, [forecastStatusFilter, isSuppliesView, project.id]);

  const financialCategories = useMemo(() => {
    return project.expenses.filter(e => e.itemType === 'category' && e.type === 'material');
  }, [project.expenses]);

  const sortedForecasts = useMemo(() => {
    return [...planning.forecasts].sort((a, b) => a.order - b.order)
      .filter(f => {
        const matchesSearch = f.description.toLowerCase().includes(forecastSearch.toLowerCase());
        const matchesStatus = f.status === forecastStatusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [planning.forecasts, forecastSearch, forecastStatusFilter]);

  const forecastStats = useMemo(() => {
    const list = planning.forecasts || [];
    const total = list
      .filter(f => !f.isCleared)
      .reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    
    const countPending = list.filter(f => f.status === 'pending').length;
    const countOrdered = list.filter(f => f.status === 'ordered').length;
    const countDelivered = list.filter(f => f.status === 'delivered').length;

    const pending = list.filter(f => f.status === 'pending').reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    const ordered = list.filter(f => f.status === 'ordered').reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    const delivered = list.filter(f => f.status === 'delivered').reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    
    return { total, pending, ordered, delivered, countPending, countOrdered, countDelivered };
  }, [planning.forecasts]);

  const handleAutoGenerate = () => {
    const updated = planningService.generateTasksFromWbs(planning, allWorkItems);
    onUpdatePlanning(updated);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    if (activeSubTab === 'tasks') {
      const newStatus = destination.droppableId as TaskStatus;
      const updated = planningService.updateTask(planning, draggableId, { status: newStatus });
      onUpdatePlanning(updated);
    } else if (activeSubTab === 'forecast') {
      const updated = planningService.moveForecast(planning, source.index, destination.index);
      onUpdatePlanning(updated);
    }
  };

  const handleAddTask = (data: Partial<PlanningTask>) => {
    const updated = planningService.addTask(planning, data);
    onUpdatePlanning(updated);
    setIsAddingTask(null);
  };

  const handleUpdateTask = (id: string, data: Partial<PlanningTask>) => {
    const updated = planningService.updateTask(planning, id, data);
    onUpdatePlanning(updated);
  };

  const handleFinalizePurchase = (forecast: MaterialForecast, parentId: string | null, isPaid: boolean, proof?: string, purchaseDate?: string) => {
    const expenseData = planningService.prepareExpenseFromForecast(forecast, parentId, purchaseDate, isPaid);
    const supplierName = suppliers.find(s => s.id === forecast.supplierId)?.name;
    if (supplierName) {
      expenseData.entityName = supplierName;
    }
    if (isPaid && proof) {
      expenseData.paymentProof = proof;
    }
    
    onAddExpense(expenseData as ProjectExpense);
    
    const updatedPlanning = planningService.updateForecast(planning, forecast.id, { 
      status: 'ordered', 
      isPaid: isPaid, 
      paymentProof: proof,
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0]
    });
    onUpdatePlanning(updatedPlanning);
    setConfirmingForecast(null);
    setForecastStatusFilter('ordered');
  };

  const handleViewProof = (proof: string) => {
    const win = window.open();
    win?.document.write(`<iframe src="${proof}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  };

  const [isImportingPlan, setIsImportingPlan] = useState(false);

  const handleImportPlanning = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingPlan(true);
    try {
      const newPlanning = await excelService.parsePlanningExcel(file);
      // send as replace to backend (single request)
      await planningApi.replace(project.id, {
        tasks: newPlanning.tasks,
        forecasts: newPlanning.forecasts,
        milestones: newPlanning.milestones,
      });

      onUpdatePlanning(newPlanning);
    } catch (err) {
      console.error('Erro ao importar planejamento:', err);
      toast.error("Erro ao importar planejamento.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImportingPlan(false);
    }
  };

  const columns: { id: TaskStatus, label: string, color: string }[] = [
    { id: 'todo', label: 'Planejado', color: 'indigo' },
    { id: 'doing', label: 'Executando', color: 'amber' },
    { id: 'done', label: 'Concluído', color: 'emerald' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx, .xls" 
        onChange={handleImportPlanning}
      />
      
      {!canEditPlanning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <span className="text-amber-800">
            Você tem apenas permissão de leitura. Para editar {isSuppliesView ? 'suprimentos' : 'planejamento'}, solicite acesso ao administrador.
          </span>
        </div>
      )}
      
      {!isSuppliesView && (
        <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20">
              <HardHat size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                Planejamento Operacional
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                  Gestão Ágil de Canteiro
                </p>
                <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                <button
                  onClick={() => window.print()}
                  className="text-[10px] font-black uppercase text-indigo-600 flex items-center gap-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 px-2 py-1 rounded-lg transition-all"
                >
                  <Printer size={14}/> Imprimir
                </button>
                <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Importar Excel"
                  >
                    <UploadCloud size={16}/>
                  </button>
                  <button
                    onClick={() => excelService.exportPlanningToExcel(project)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Exportar Excel"
                  >
                    <Download size={16}/>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
            <SubTabBtn active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} label="Quadro Kanban" icon={<ListChecks size={14}/>} />
            <SubTabBtn active={activeSubTab === 'milestones'} onClick={() => setActiveSubTab('milestones')} label="Cronograma" icon={<Target size={14}/>} />
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        {activeSubTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-4">
               <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Fluxo de Trabalho</h3>
               </div>
               <button onClick={handleAutoGenerate} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                  <Wand2 size={16} /> Inteligência EAP
               </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {columns.map(col => (
                <div key={col.id} className="bg-slate-100/50 dark:bg-slate-900/40 rounded-[2.5rem] flex flex-col min-h-[600px] border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors">
                  <div className="p-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-6 rounded-full bg-${col.color}-500`} />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">{col.label}</span>
                      <span className="bg-white dark:bg-slate-800 text-[10px] font-black px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">{planning.tasks.filter(t => (t.status || (t.isCompleted ? 'done' : 'todo')) === col.id).length}</span>
                    </div>
                    <button onClick={() => setIsAddingTask(col.id)} className="p-2 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all"><Plus size={16}/></button>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef}
                        className={`flex-1 p-4 space-y-3 transition-colors rounded-[2rem] ${snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                      >
                        {planning.tasks
                          .filter(t => (t.status || (t.isCompleted ? 'done' : 'todo')) === col.id)
                          .map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(p, s) => (
                                <div 
                                  ref={p.innerRef} 
                                  {...p.draggableProps}
                                  onClick={() => setEditingTask(task)}
                                  className={`group bg-white dark:bg-slate-900 p-5 rounded-3xl border transition-all cursor-pointer select-none hover:shadow-xl hover:-translate-y-1 ${s.isDragging ? 'shadow-2xl ring-2 ring-indigo-500 z-50' : 'border-slate-100 dark:border-slate-800 shadow-sm'}`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div {...p.dragHandleProps} className="p-1 text-slate-300 hover:text-indigo-500"><GripVertical size={14}/></div>
                                    <button onClick={(e) => { e.stopPropagation(); onUpdatePlanning(planningService.deleteTask(planning, task.id)); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
                                  </div>
                                  <h4 className={`text-sm font-bold leading-relaxed whitespace-normal break-words ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>
                                    {task.description}
                                  </h4>
                                  <div className="mt-4 flex flex-wrap items-center gap-2">
                                     <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                       planningService.getUrgencyLevel(task.dueDate) === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'
                                     }`}>
                                       <Calendar size={10}/> {financial.formatDate(task.dueDate)}
                                     </div>
                                     {task.categoryId && (
                                       <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2 py-1 rounded-lg text-[8px] font-black uppercase">EAP</span>
                                     )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'forecast' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ForecastKpi label="Previsão de Suprimentos" value={forecastStats.total} icon={<Boxes size={20}/>} color="indigo" sub="Previsão global de gastos" />
                <ForecastKpi label="Pendente de Compra" value={forecastStats.pending} icon={<Clock size={20}/>} color="amber" sub="Ainda não efetivado" />
                <ForecastKpi label="Efetivado/Local" value={forecastStats.ordered + forecastStats.delivered} icon={<CheckCircle2 size={20}/>} color="emerald" sub="Lançado no financeiro" />
             </div>

             <div className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
                    <ProcurementStep 
                      active={forecastStatusFilter === 'pending'} 
                      onClick={() => setForecastStatusFilter('pending')}
                      label="A Comprar"
                      count={forecastStats.countPending}
                      icon={<ShoppingCart size={14}/>}
                      color="amber"
                    />
                    <ArrowRight size={14} className="text-slate-300 mx-1 hidden sm:block"/>
                    <ProcurementStep 
                      active={forecastStatusFilter === 'ordered'} 
                      onClick={() => setForecastStatusFilter('ordered')}
                      label="Pedidos de Compra"
                      count={forecastStats.countOrdered}
                      icon={<Clock size={14}/>}
                      color="blue"
                    />
                    <ArrowRight size={14} className="text-slate-300 mx-1 hidden sm:block"/>
                    <ProcurementStep 
                      active={forecastStatusFilter === 'delivered'} 
                      onClick={() => setForecastStatusFilter('delivered')}
                      label="Recebidos (Local)"
                      count={forecastStats.countDelivered}
                      icon={<Truck size={14}/>}
                      color="emerald"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-all"
                    >
                      <Printer size={16} /> PDF
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-slate-400 hover:text-emerald-600"
                      title="Importar Excel"
                    >
                      <UploadCloud size={18} />
                    </button>
                    <button
                      onClick={() => excelService.exportPlanningToExcel(project)}
                      className="p-2.5 text-slate-400 hover:text-blue-600"
                      title="Exportar Excel"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <div className="flex flex-wrap items-center justify-end gap-2 mb-6">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input 
                        placeholder="Pesquisar..."
                        className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all w-40"
                        value={forecastSearch}
                        onChange={e => setForecastSearch(e.target.value)}
                      />
                    </div>
                    {forecastStatusFilter === 'pending' && (
                      <button onClick={() => setIsAddingForecast(true)} className="inline-flex items-center gap-2 whitespace-nowrap px-5 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg hover:scale-105 transition-transform">
                        <Plus size={16} /> Novo Insumo
                      </button>
                    )}
                  </div>

                  <table className="w-full text-left border-separate border-spacing-y-3">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">
                        <th className="pb-2 w-12"></th>
                        <th className="pb-2 pl-4 text-left">Material / Fornecedor</th>
                        <th className="pb-2">Und</th>
                        <th className="pb-2">Qtd</th>
                        <th className="pb-2">Unitário</th>
                        <th className="pb-2">Total Previsto</th>
                        <th className="pb-2">Status</th>
                        {forecastStatusFilter === 'ordered' && (
                          <th className="pb-2">Pago?</th>
                        )}
                        {forecastStatusFilter === 'delivered' && (
                          <th className="pb-2">Dar Baixa?</th>
                        )}
                        <th className="pb-2 text-right pr-4">Ações</th>
                      </tr>
                    </thead>
                    <Droppable droppableId="forecast-list">
                      {(provided) => (
                        <tbody ref={provided.innerRef} {...provided.droppableProps} className="text-center">
                          {sortedForecasts.map((f, index) => {
                            const supplier = suppliers.find(s => s.id === f.supplierId);
                            
                            // Lógica refinada de rótulo e valor de data baseada no status e pagamento
                            let dateLabel = 'Previsto';
                            let dateValue = f.estimatedDate;
                            let dateColor = 'text-slate-400';
                            let statusText = '';

                            if (f.status === 'pending') {
                              dateLabel = 'Previsto';
                              dateValue = f.estimatedDate;
                              dateColor = 'text-slate-400';
                            } else if (f.status === 'ordered') {
                              if (f.isPaid) {
                                dateLabel = 'Pago';
                                dateColor = 'text-indigo-500';
                              } else {
                                dateLabel = 'Comprado';
                                dateColor = 'text-amber-500';
                                statusText = '(A Pagar)';
                              }
                              dateValue = f.purchaseDate || f.estimatedDate;
                            } else if (f.status === 'delivered') {
                              dateLabel = 'Entregue';
                              dateValue = f.deliveryDate || f.estimatedDate;
                              dateColor = 'text-emerald-500';
                            }

                            return (
                              <Draggable key={f.id} draggableId={f.id} index={index}>
                                {(p, s) => (
                                  <tr 
                                    ref={p.innerRef} 
                                    {...p.draggableProps} 
                                    className={`group/row bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl transition-all shadow-sm ${s.isDragging ? 'shadow-2xl z-50 ring-2 ring-indigo-500 scale-[1.02]' : 'hover:shadow-md'}`}
                                  >
                                    <td className="py-6 pl-4 rounded-l-3xl">
                                      <div {...p.dragHandleProps} className="p-2 text-slate-200 hover:text-indigo-400 cursor-grab active:cursor-grabbing">
                                        <GripVertical size={16}/>
                                      </div>
                                    </td>
                                    <td className="py-6 px-4 text-left min-w-[250px]">
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-black dark:text-white leading-tight uppercase">{f.description}</span>
                                          {f.paymentProof && (
                                            <button onClick={() => handleViewProof(f.paymentProof!)} className="p-1 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors" title="Ver Comprovante">
                                              <ReceiptText size={10} />
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                          <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                                            <Building2 size={10} className="shrink-0" />
                                            {supplier ? supplier.name : 'Fornecedor não vinculado'}
                                          </div>
                                          <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${dateColor}`}>
                                            <Calendar size={9} className="shrink-0" />
                                            {dateLabel}: {financial.formatDate(dateValue)} <span className="ml-1 opacity-70">{statusText}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-6">
                                      <span className="text-[10px] font-black uppercase text-slate-400">{f.unit}</span>
                                    </td>
                                    <td className="py-6">
                                      <input 
                                        type="number"
                                        step="any"
                                        className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg px-2 py-1 text-center text-[11px] font-black outline-none focus:border-indigo-500 transition-all dark:text-slate-200"
                                        value={f.quantityNeeded}
                                        onBlur={(e) => onUpdatePlanning(planningService.updateForecast(planning, f.id, { quantityNeeded: parseFloat(e.target.value) || 0 }))}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          onUpdatePlanning(planningService.updateForecast(planning, f.id, { quantityNeeded: parseFloat(val) || 0 }));
                                        }}
                                      />
                                    </td>
                                    <td className="py-6">
                                      <InlineCurrencyInput 
                                        value={f.unitPrice} 
                                        onUpdate={(val: number) => onUpdatePlanning(planningService.updateForecast(planning, f.id, { unitPrice: val }))} 
                                      />
                                    </td>
                                    <td className="py-6">
                                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                        {financial.formatVisual((f.quantityNeeded || 0) * (f.unitPrice || 0), project.theme?.currencySymbol)}
                                      </span>
                                    </td>
                                    <td className="py-6">
                                      <div className="flex gap-2 justify-center">
                                        <StatusCircle active={f.status === 'pending'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'pending' }))} icon={<AlertCircle size={12}/>} color="amber" label="Pendente" />
                                        <StatusCircle active={f.status === 'ordered'} onClick={() => setConfirmingForecast(f)} icon={<ShoppingCart size={12}/>} color="blue" label="Comprado" />
                                        <StatusCircle
                                          active={f.status === 'delivered'}
                                          onClick={() => {
                                            if (f.status === 'pending') {
                                              toast.warning('Para marcar como No Local, primeiro registre como Comprado.');
                                              return;
                                            }
                                            onUpdatePlanning(planningService.updateForecast(planning, f.id, {
                                              status: 'delivered',
                                              deliveryDate: new Date().toISOString().split('T')[0]
                                            }));
                                          }}
                                          icon={<Truck size={12}/>}
                                          color="emerald"
                                          label="No Local"
                                        />
                                      </div>
                                    </td>
                                    {forecastStatusFilter === 'ordered' && (
                                      <td className="py-6">
                                        <button 
                                          onClick={() => {
                                            if (f.status === 'pending') {
                                              setConfirmingForecast(f);
                                            } else {
                                              onUpdatePlanning(planningService.updateForecast(planning, f.id, { isPaid: !f.isPaid }));
                                            }
                                          }}
                                          className={`p-2.5 rounded-full transition-all ${f.isPaid ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-rose-400 bg-slate-50 dark:bg-slate-800'}`}
                                        >
                                          {f.isPaid ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                        </button>
                                      </td>
                                    )}
                                    {forecastStatusFilter === 'delivered' && (
                                      <td className="py-6">
                                        <button
                                          onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { isCleared: !f.isCleared }))}
                                          className={`p-2.5 rounded-full transition-all ${f.isCleared ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm' : 'text-slate-200 hover:text-emerald-400 bg-slate-50 dark:bg-slate-800'}`}
                                        >
                                          {f.isCleared ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
                                        </button>
                                      </td>
                                    )}
                                    <td className="py-6 text-right pr-6 rounded-r-3xl">
                                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                        {f.status === 'pending' && (
                                          <button 
                                            onClick={() => setConfirmingForecast(f)}
                                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl"
                                            title="Efetivar Compra"
                                          >
                                            <ArrowUpRight size={18}/>
                                          </button>
                                        )}
                                        {f.status === 'ordered' && (
                                          <button 
                                            onClick={() => setConfirmingForecast(f)}
                                            className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl"
                                            title="Anexar Comprovante"
                                          >
                                            <ReceiptText size={18}/>
                                          </button>
                                        )}
                                        {f.paymentProof && (
                                          <button onClick={() => handleViewProof(f.paymentProof!)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl" title="Baixar Comprovante"><Download size={18}/></button>
                                        )}
                                        <button onClick={() => setEditingForecast(f)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl" title="Editar"><Edit2 size={18}/></button>
                                        <button onClick={() => setIsDeletingForecast(f)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl" title="Excluir"><Trash2 size={18}/></button>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                        </tbody>
                      )}
                    </Droppable>
                  </table>
                  {sortedForecasts.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-300 opacity-40">
                      <Boxes size={64} className="mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Sem suprimentos neste estágio</p>
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}
      </DragDropContext>

      {/* MODAL DE CADASTRO/EDIÇÃO DE SUPRIMENTO (DARK PREMIUM) */}
      {(isAddingForecast || editingForecast) && (
        <ForecastModal 
          onClose={() => { setIsAddingForecast(false); setEditingForecast(null); }}
          allWorkItems={allWorkItems}
          suppliers={suppliers}
          editingItem={editingForecast}
          onSave={(data: any) => {
            if (editingForecast) {
              onUpdatePlanning(planningService.updateForecast(planning, editingForecast.id, data));
            } else {
              onUpdatePlanning(planningService.addForecast(planning, data));
            }
            setIsAddingForecast(false);
            setEditingForecast(null);
          }}
        />
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {isDeletingForecast && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsDeletingForecast(null)}>
          <div className="bg-white dark:bg-[#0f111a] w-full max-w-md rounded-[3rem] p-12 shadow-2xl border border-slate-200 dark:border-slate-800/50 flex flex-col items-center text-center relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-[100px] pointer-events-none"></div>
            <div className="relative mb-10">
              <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
                 <Trash2 size={36} className="text-rose-500" />
              </div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Remover Insumo?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed mb-12">
              Deseja realmente excluir o suprimento <span className="text-slate-900 dark:text-white font-bold">{isDeletingForecast.description}</span>? Esta ação é irreversível.
            </p>
            <div className="flex items-center gap-6 w-full">
               <button onClick={() => setIsDeletingForecast(null)} className="flex-1 py-4 text-slate-500 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
               <button onClick={() => { onUpdatePlanning(planningService.deleteForecast(planning, isDeletingForecast.id)); setIsDeletingForecast(null); }} className="flex-[2] py-5 bg-rose-600 hover:bg-rose-50 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all">Excluir Permanente</button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'milestones' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="flex items-center justify-between">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                 <button onClick={() => setMilestoneView('list')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${milestoneView === 'list' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}><List size={14}/> Lista</button>
                 <button onClick={() => setMilestoneView('calendar')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${milestoneView === 'calendar' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}><CalendarDays size={14}/> Calendário</button>
              </div>
              <button onClick={() => setIsAddingMilestone(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Nova Meta
              </button>
           </div>

           {milestoneView === 'list' ? (
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative space-y-10 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-1 before:bg-slate-100 dark:before:bg-slate-800">
                  {planning.milestones.map(m => (
                    <div key={m.id} className="relative flex items-center justify-between pl-10">
                      <div className={`absolute left-0 w-7 h-7 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-md ${m.isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}>
                        <Flag size={12} className="text-white" />
                      </div>
                      <div className={`flex-1 ml-6 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border transition-all flex items-center justify-between group ${m.isCompleted ? 'border-emerald-200' : 'border-slate-100 dark:border-slate-800'}`}>
                        <div className="flex flex-col gap-1">
                           <h4 className="text-base font-black dark:text-white uppercase tracking-tight">{m.title}</h4>
                           <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                             <Calendar size={14}/> {financial.formatDate(m.date)}
                           </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => onUpdatePlanning(planningService.updateMilestone(planning, m.id, { isCompleted: !m.isCompleted }))} className={`text-[10px] font-black uppercase px-5 py-2 rounded-full border transition-all ${m.isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                            {m.isCompleted ? 'Finalizada' : 'Em Aberto'}
                          </button>
                          <button onClick={() => setEditingMilestone(m)} className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-white rounded-lg transition-all"><Edit2 size={18}/></button>
                          <button onClick={() => onUpdatePlanning(planningService.deleteMilestone(planning, m.id))} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-white rounded-lg transition-all"><Trash2 size={18}/></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
           ) : (
             <CalendarView milestones={planning.milestones} onEdit={setEditingMilestone} />
           )}
        </div>
      )}

      {/* MODAIS TAREFA E MILESTONE */}
      {(editingTask || isAddingTask) && (
        <TaskModal 
          task={editingTask} 
          initialStatus={isAddingTask}
          onClose={() => { setEditingTask(null); setIsAddingTask(null); }} 
          onSave={(data: Partial<PlanningTask>) => {
            if (editingTask) handleUpdateTask(editingTask.id, data);
            else handleAddTask(data);
            setEditingTask(null);
            setIsAddingTask(null);
          }}
        />
      )}

      {(editingMilestone || isAddingMilestone) && (
        <MilestoneModal 
          milestone={editingMilestone}
          onClose={() => { setEditingMilestone(null); setIsAddingMilestone(false); }}
          onSave={(data: Partial<Milestone>) => {
            if (editingMilestone) onUpdatePlanning(planningService.updateMilestone(planning, editingMilestone.id, data));
            else onUpdatePlanning(planningService.addMilestone(planning, data));
            setEditingMilestone(null);
            setIsAddingMilestone(false);
          }}
        />
      )}

      {/* MODAL DE EFETIVAR COMPRA (CORRIGIDO E DARK) */}
      {confirmingForecast && (
        <ConfirmForecastModal 
          forecast={confirmingForecast} 
          onClose={() => setConfirmingForecast(null)} 
          onConfirm={(isPaid: boolean, parentId: string | null, proof?: string, purchaseDate?: string) => handleFinalizePurchase(confirmingForecast, parentId, isPaid, proof, purchaseDate)}
          financialCategories={financialCategories}
        />
      )}
    </div>
  );
};

// --- PREMIUM COMPONENTS ---

const ProcurementStep = ({ active, onClick, label, count, icon, color }: any) => {
  const colors: any = {
    amber: active ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600',
    blue: active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600',
    emerald: active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
  };

  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${colors[color]}`}
    >
      {icon}
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${active ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
};

// --- PREMIUM FORECAST MODAL (DARK) ---
const ForecastModal = ({ onClose, onSave, allWorkItems, suppliers, editingItem }: any) => {
  const [data, setData] = useState({
    description: editingItem?.description || '',
    quantityNeeded: editingItem?.quantityNeeded || 1,
    unitPrice: editingItem?.unitPrice || 0,
    unit: editingItem?.unit || 'un',
    isPaid: editingItem?.isPaid || false,
    isCleared: editingItem?.isCleared || false,
    estimatedDate: (editingItem?.estimatedDate || new Date().toISOString()).split('T')[0],
    supplierId: editingItem?.supplierId || '',
    categoryId: editingItem?.categoryId || '',
    paymentProof: editingItem?.paymentProof || ''
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-2xl rounded-[3rem] border border-slate-200 dark:border-slate-800/50 shadow-2xl flex flex-col overflow-hidden max-h-[95vh] relative" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
        
        <div className="p-10 pb-6 shrink-0 flex items-center justify-between z-10">
          <div className="flex items-center gap-5">
             <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-3xl border border-slate-200 dark:border-slate-700/50 text-indigo-500 shadow-xl">
                <Boxes size={28}/>
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">{editingItem ? 'Editar Insumo' : 'Novo Suprimento'}</h2>
               <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Inteligência de Aquisições</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-white transition-all rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/50"><X size={24}/></button>
        </div>

        <div className="p-10 pt-0 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-8">
           <div>
              <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Descrição Técnica do Material</label>
              <input 
                autoFocus 
                className="w-full px-8 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-base font-black outline-none focus:border-indigo-600 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-800" 
                value={data.description} 
                onChange={e => setData({...data, description: e.target.value})} 
                placeholder="Ex: Cimento Portland CP-II" 
              />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Vínculo de Fornecedor</label>
                <div className="relative">
                   <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                   <select 
                    className="w-full pl-14 pr-10 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all" 
                    value={data.supplierId} 
                    onChange={e => setData({...data, supplierId: e.target.value})}
                   >
                     <option value="">Não definido (Spot)</option>
                     {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                   <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={16} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 ml-1">Previsão de Chegada</label>
                <div className="relative">
                   <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                   <input 
                    type="date" 
                    className="w-full pl-14 pr-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none focus:border-indigo-600 transition-all dark:[color-scheme:dark]" 
                    value={data.estimatedDate} 
                    onChange={e => setData({...data, estimatedDate: e.target.value})} 
                   />
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 text-center">Unidade</label>
                <input 
                  className="w-full px-4 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-center uppercase outline-none focus:border-indigo-600" 
                  value={data.unit} 
                  onChange={e => setData({...data, unit: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 text-center">Quantidade</label>
                <input 
                  type="number" 
                  className="w-full px-4 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-center outline-none focus:border-indigo-600" 
                  value={data.quantityNeeded} 
                  onChange={e => setData({...data, quantityNeeded: parseFloat(e.target.value) || 0})} 
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 text-right">Preço Unitário</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase">R$</span>
                  <input 
                    type="number" 
                    className="w-full pl-12 pr-6 py-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-sm font-black text-right outline-none focus:border-indigo-600" 
                    value={data.unitPrice} 
                    onChange={e => setData({...data, unitPrice: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>
           </div>

           <div className="flex flex-col sm:flex-row items-center justify-between p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 gap-6">
              <div className="flex items-center gap-4">
                 <div className={`p-4 rounded-2xl ${data.isPaid ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'} transition-colors shadow-lg`}>
                    <CreditCard size={24}/>
                 </div>
                 <div>
                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none">Estado Financeiro</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white mt-2">{data.isPaid ? 'Pago e Liquidado' : 'Aguardando Pagamento'}</p>
                 </div>
              </div>
              <button 
                type="button" 
                onClick={() => setData({...data, isPaid: !data.isPaid})}
                className={`w-16 h-8 rounded-full relative transition-all shadow-inner ${data.isPaid ? 'bg-emerald-500' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${data.isPaid ? 'left-9' : 'left-1'}`} />
              </button>
           </div>
           
           {data.paymentProof && (
             <div className="p-6 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-3xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
                   <FileCheck size={20}/>
                   <span className="text-[10px] font-black uppercase tracking-widest">Comprovante Vinculado</span>
                </div>
                <button type="button" onClick={() => setData({...data, paymentProof: ''})} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all">
                  <X size={16}/>
                </button>
             </div>
           )}
        </div>

        <div className="p-10 pt-4 border-t border-slate-200 dark:border-slate-800/50 flex items-center gap-6 shrink-0 z-10 bg-slate-50 dark:bg-[#0f111a]/80 backdrop-blur-sm">
           <button 
            onClick={onClose} 
            className="flex-1 py-5 text-slate-500 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors"
           >
             Cancelar
           </button>
           <button 
            onClick={() => onSave(data)} 
            disabled={!data.description} 
            className="flex-[2] py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-[0_15px_35px_-10px_rgba(79,70,229,0.5)] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
           >
             <Save size={20} /> {editingItem ? 'Atualizar Registro' : 'Confirmar Inclusão'}
           </button>
        </div>
      </div>
    </div>
  );
};

const SubTabBtn = ({ active, onClick, label, icon }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

const ForecastKpi = ({ label, value, icon, color, sub }: any) => {
  const colors: any = {
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-800',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{financial.formatVisual(value, 'R$')}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
};

const StatusCircle = ({ active, onClick, icon, color, label }: any) => {
  const colors: any = {
    amber: active ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
    blue: active ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400',
    emerald: active ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
  };
  return (
    <div className="group/status relative flex justify-center">
      <button 
        onClick={onClick} 
        className={`p-2 rounded-full transition-all ${colors[color]}`}
      >
        {icon}
      </button>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-slate-900 text-white text-[9px] font-black uppercase rounded-lg opacity-0 group-hover/status:opacity-100 transition-all pointer-events-none whitespace-nowrap shadow-xl z-[100] transform group-hover/status:-translate-y-1">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
      </span>
    </div>
  );
};

const CalendarView = ({ milestones, onEdit }: { milestones: Milestone[], onEdit: (m: Milestone) => void }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthLabel = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  const gridDays = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const startOffset = firstDayOfMonth(year, month);
    const days = [];
    
    for (let i = 0; i < startOffset; i++) days.push(null);
    
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayMilestones = milestones.filter(m => m.date.startsWith(dateStr));
      days.push({ day: i, milestones: dayMilestones, dateStr });
    }
    return days;
  }, [currentDate, milestones]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none">{monthLabel}</h3>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"><ChevronLeft size={20}/></button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 bg-white dark:bg-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">Hoje</button>
          <button onClick={nextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
          {weekDays.map(d => (
            <div key={d} className="bg-white dark:bg-slate-900 py-4 text-center">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{d}</span>
            </div>
          ))}
          
          {gridDays.map((d, i) => (
            <div key={i} className={`bg-white dark:bg-slate-900 min-h-[150px] p-3 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${!d ? 'opacity-30' : ''}`}>
              {d && (
                <div className="flex flex-col gap-2 h-full">
                  <span className={`text-[11px] font-black ${new Date().toDateString() === new Date(d.dateStr).toDateString() ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-lg shadow-lg' : 'text-slate-400'}`}>
                    {d.day}
                  </span>
                  
                  <div className="flex flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {d.milestones.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => onEdit(m)}
                        className={`text-[9px] font-bold p-2 rounded-lg text-left border transition-all ${
                          m.isCompleted 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:scale-[1.02] hover:bg-indigo-100'
                        }`}
                      >
                        <div className="truncate">{m.title}</div>
                        <div className="text-[7px] opacity-60 uppercase mt-0.5">{m.isCompleted ? 'Finalizado' : 'Aguardando'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TaskModal = ({ task, initialStatus, onClose, onSave }: any) => {
  const [desc, setDesc] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || initialStatus || 'todo');
  const [date, setDate] = useState(task?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
        <div className="space-y-4">
          <textarea autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={desc} onChange={e => setDesc(e.target.value)} placeholder="O que precisa ser feito?" />
          <div className="grid grid-cols-2 gap-4">
            <select className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none" value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="todo">Planejado</option>
              <option value="doing">Executando</option>
              <option value="done">Concluído</option>
            </select>
            <input type="date" className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ description: desc, status, dueDate: date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
        </div>
      </div>
    </div>
  );
};

const MilestoneModal = ({ milestone, onClose, onSave }: any) => {
  const [title, setTitle] = useState(milestone?.title || '');
  const [date, setDate] = useState(milestone?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{milestone ? 'Editar Meta' : 'Nova Meta'}</h2>
        <div className="space-y-4">
          <input autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da Meta" />
          <input type="date" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-indigo-500 transition-all" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ title, date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Salvar</button>
        </div>
      </div>
    </div>
  );
};

// --- CONFIRM PURCHASE MODAL ---
const ConfirmForecastModal = ({ forecast, onClose, onConfirm, financialCategories }: any) => {
  const [parentId, setParentId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);
  const [paymentProof, setPaymentProof] = useState<string | undefined>(forecast.paymentProof);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white dark:bg-[#0f111a] w-full max-w-2xl rounded-[3rem] p-8 border border-slate-200 dark:border-slate-800/50 shadow-2xl flex flex-col items-center relative overflow-hidden text-center max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="relative mb-8">
           <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800/40 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
              <Wallet size={32} className="text-indigo-500" />
           </div>
        </div>

        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Efetivar Compra</h2>
        
        <div className="space-y-6 mb-8 w-full text-center">
           <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
             Registrar compra de <span className="text-slate-900 dark:text-white font-bold">{forecast.description}</span> no valor de <span className="text-indigo-600 dark:text-indigo-400 font-bold">{financial.formatVisual((forecast.quantityNeeded || 0) * (forecast.unitPrice || 0), 'R$')}</span>.
           </p>
           
           <div className="text-left space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 block tracking-widest ml-1">Data da Compra</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={14} />
                    <input 
                      type="date"
                      className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all dark:[color-scheme:dark]"
                      value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className={isPaid ? "text-emerald-500" : "text-slate-500"} />
                    <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase">Marcar como Pago agora?</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsPaid(!isPaid)}
                    className={`w-12 h-6 rounded-full relative transition-all ${isPaid ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isPaid ? 'left-6.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {isPaid && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                    <ExpenseAttachmentZone 
                        label="Comprovante de Pagamento"
                        requiredStatus="PAID"
                        currentFile={paymentProof}
                      onUploadUrl={(url) => setPaymentProof(url)}
                        onRemove={() => setPaymentProof(undefined)}
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase mb-2 block tracking-widest ml-1">Vincular ao Grupo Financeiro (Opcional)</label>
                  <div className="relative">
                    <FolderTree className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600" size={14} />
                    <select 
                      className="w-full pl-10 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white text-xs font-bold outline-none appearance-none focus:border-indigo-600 transition-all" 
                      value={parentId || ''} 
                      onChange={e => setParentId(e.target.value || null)}
                    >
                      <option value="">Sem grupo (Raiz do Financeiro)</option>
                      {financialCategories.map((c: any) => <option key={c.id} value={c.id}>{c.description}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none" size={14} />
                  </div>
                </div>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4 w-full">
           <button onClick={onClose} className="flex-1 py-4 text-slate-500 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:text-slate-800 dark:hover:text-white transition-colors">Voltar</button>
           <button 
              onClick={() => onConfirm(isPaid, parentId, paymentProof, purchaseDate)} 
              className={`flex-[2] py-4 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all ${
                isPaid ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20 text-white' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 text-white'
              }`}
           >
              {isPaid ? 'Confirmar e Pagar' : 'Confirmar Pedido'}
           </button>
        </div>
      </div>
    </div>
  );
};

// --- INLINE EDITING HELPERS ---
const InlineCurrencyInput = ({ value, onUpdate }: { value: number, onUpdate: (val: number) => void }) => {
  const [localVal, setLocalVal] = useState(financial.formatVisual(value, '').trim());
  
  useEffect(() => {
    setLocalVal(financial.formatVisual(value, '').trim());
  }, [value]);

  return (
    <div className="flex items-center justify-center gap-1.5 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 group hover:border-indigo-400 transition-all">
      <span className="text-[9px] font-black text-slate-400">R$</span>
      <input 
        type="text" 
        className="w-20 bg-transparent text-right text-[11px] font-black dark:text-slate-200 outline-none" 
        value={localVal}
        onChange={(e) => setLocalVal(financial.maskCurrency(e.target.value))}
        onBlur={(e) => onUpdate(financial.parseLocaleNumber(e.target.value))}
      />
    </div>
  );
};
