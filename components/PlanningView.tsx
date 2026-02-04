
import React, { useState, useMemo, useRef } from 'react';
import { Project, PlanningTask, MaterialForecast, Milestone, WorkItem, TaskStatus, ProjectPlanning, ProjectExpense } from '../types';
import { planningService } from '../services/planningService';
import { excelService } from '../services/excelService';
import { financial } from '../utils/math';
import { 
  CheckCircle2, Circle, Clock, Package, Flag, Plus, 
  Trash2, Calendar, AlertCircle, ShoppingCart, Truck, Search,
  Wand2, ArrowUpRight, Ban, ListChecks, Boxes, Target,
  GripVertical, MoreVertical, Edit2, X, Save, Calculator, Wallet, Link,
  ChevronUp, ChevronDown, List, CalendarDays, Filter, Users, Download, UploadCloud,
  Layers, FlagTriangleRight, Printer
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface PlanningViewProps {
  project: Project;
  onUpdatePlanning: (planning: ProjectPlanning) => void;
  onAddExpense: (expense: ProjectExpense) => void;
  categories: WorkItem[];
  allWorkItems: WorkItem[];
}

export const PlanningView: React.FC<PlanningViewProps> = ({ 
  project, onUpdatePlanning, onAddExpense, categories, allWorkItems 
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'tasks' | 'forecast' | 'milestones'>('tasks');
  const [editingTask, setEditingTask] = useState<PlanningTask | null>(null);
  const [confirmingForecast, setConfirmingForecast] = useState<MaterialForecast | null>(null);
  const [isAddingForecast, setIsAddingForecast] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState<TaskStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [milestoneView, setMilestoneView] = useState<'list' | 'calendar'>('list');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastStatusFilter, setForecastStatusFilter] = useState<'all' | 'pending' | 'ordered' | 'delivered'>('all');

  const planning = project.planning;

  const financialCategories = useMemo(() => {
    return project.expenses.filter(e => e.itemType === 'category');
  }, [project.expenses]);

  const sortedForecasts = useMemo(() => {
    return [...planning.forecasts].sort((a, b) => a.order - b.order)
      .filter(f => {
        const matchesSearch = f.description.toLowerCase().includes(forecastSearch.toLowerCase());
        const matchesStatus = forecastStatusFilter === 'all' || f.status === forecastStatusFilter;
        return matchesSearch && matchesStatus;
      });
  }, [planning.forecasts, forecastSearch, forecastStatusFilter]);

  const forecastStats = useMemo(() => {
    const list = planning.forecasts || [];
    const total = list.reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    const pending = list.filter(f => f.status === 'pending').reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    const ordered = list.filter(f => f.status !== 'pending').reduce((acc, f) => acc + ((f.quantityNeeded || 0) * (f.unitPrice || 0)), 0);
    return { total, pending, ordered };
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

  const handleFinalizePurchase = (forecast: MaterialForecast, parentId: string | null) => {
    const expenseData = planningService.prepareExpenseFromForecast(forecast, parentId);
    onAddExpense(expenseData as ProjectExpense);
    const updatedPlanning = planningService.updateForecast(planning, forecast.id, { status: 'ordered' });
    onUpdatePlanning(updatedPlanning);
    setConfirmingForecast(null);
  };

  const handleImportPlanning = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await excelService.parsePlanningExcel(file);
      onUpdatePlanning(imported);
    } catch (err) {
      alert("Erro ao importar planilha de planejamento.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const columns: { id: TaskStatus, label: string, color: string }[] = [
    { id: 'todo', label: 'Planejado', color: 'indigo' },
    { id: 'doing', label: 'Executando', color: 'amber' },
    { id: 'done', label: 'Concluído', color: 'emerald' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportPlanning} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20">
            <Calendar size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Planejamento Operacional</h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Gestão Ágil de Canteiro</p>
              <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              <button 
                onClick={() => window.print()}
                className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1 hover:underline"
              >
                <Printer size={12}/> Imprimir
              </button>
              <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              <button onClick={() => excelService.exportPlanningToExcel(project)} className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1 hover:underline"><Download size={12}/> Exportar</button>
              <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black uppercase text-indigo-600 flex items-center gap-1 hover:underline ml-2"><UploadCloud size={12}/> Importar</button>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
          {/* Fix: SubTabBtn defined below */}
          <SubTabBtn active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} label="Quadro Kanban" icon={<ListChecks size={14}/>} />
          <SubTabBtn active={activeSubTab === 'forecast'} onClick={() => setActiveSubTab('forecast')} label="Suprimentos" icon={<Boxes size={14}/>} />
          <SubTabBtn active={activeSubTab === 'milestones'} onClick={() => setActiveSubTab('milestones')} label="Cronograma" icon={<Target size={14}/>} />
        </div>
      </div>

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
                                  <h4 className={`text-sm font-bold leading-relaxed whitespace-normal break-words ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
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
                {/* Fix: ForecastKpi defined below */}
                <ForecastKpi label="Total em Suprimentos" value={forecastStats.total} icon={<Boxes size={20}/>} color="indigo" sub="Previsão global de gastos" />
                <ForecastKpi label="Pendente de Compra" value={forecastStats.pending} icon={<Clock size={20}/>} color="amber" sub="Ainda não efetivado" />
                <ForecastKpi label="Efetivado/Local" value={forecastStats.ordered} icon={<CheckCircle2 size={20}/>} color="emerald" sub="Lançado no financeiro" />
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Lista de Compras Planejada</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Gestão de insumos e matérias-primas antes do faturamento.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input 
                        placeholder="Filtrar materiais..."
                        className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all w-64"
                        value={forecastSearch}
                        onChange={e => setForecastSearch(e.target.value)}
                      />
                    </div>
                    <button onClick={() => setIsAddingForecast(true)} className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                      <Plus size={16} /> Adicionar Insumo
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 text-center">
                        <th className="pb-4 w-12"></th>
                        <th className="pb-4 pl-4 text-left">Material / Insumo</th>
                        <th className="pb-4">Und</th>
                        <th className="pb-4">QNT</th>
                        <th className="pb-4">UNT</th>
                        <th className="pb-4">Custo</th>
                        <th className="pb-4">Data da Compra</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4 text-right pr-4">Ações</th>
                      </tr>
                    </thead>
                    <Droppable droppableId="forecast-list">
                      {(provided) => (
                        <tbody ref={provided.innerRef} {...provided.droppableProps} className="text-center">
                          {sortedForecasts.map((f, index) => (
                            <Draggable key={f.id} draggableId={f.id} index={index}>
                              {(p, s) => (
                                <tr 
                                  ref={p.innerRef} 
                                  {...p.draggableProps} 
                                  className={`group bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-transparent transition-all ${s.isDragging ? 'shadow-2xl z-50 bg-white ring-2 ring-indigo-500' : 'hover:border-emerald-200'}`}
                                >
                                  <td className="py-5 pl-4 rounded-l-[1.5rem]">
                                     <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div {...p.dragHandleProps} className="p-1 mb-1 text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing"><GripVertical size={14}/></div>
                                        <button onClick={() => onUpdatePlanning(planningService.reorderForecasts(planning, f.id, 'up'))} className="p-1 hover:bg-white rounded text-slate-300 hover:text-indigo-500"><ChevronUp size={14}/></button>
                                        <button onClick={() => onUpdatePlanning(planningService.reorderForecasts(planning, f.id, 'down'))} className="p-1 hover:bg-white rounded text-slate-300 hover:text-indigo-500"><ChevronDown size={14}/></button>
                                     </div>
                                  </td>
                                  <td className="py-5 text-left">
                                    <input className="bg-transparent text-sm font-black dark:text-white outline-none w-full" value={f.description} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { description: e.target.value }))} />
                                  </td>
                                  <td className="py-5">
                                    <input className="bg-transparent text-[10px] font-black uppercase text-slate-400 w-12 text-center outline-none" value={f.unit} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { unit: e.target.value }))} />
                                  </td>
                                  <td className="py-5">
                                    <input type="number" className="w-16 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 outline-none text-center" value={f.quantityNeeded} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { quantityNeeded: parseFloat(e.target.value) || 0 }))} />
                                  </td>
                                  <td className="py-5">
                                    <input type="number" className="w-20 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs font-black text-slate-700 dark:text-slate-300 outline-none text-right" value={f.unitPrice} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { unitPrice: parseFloat(e.target.value) || 0 }))} />
                                  </td>
                                  <td className="py-5">
                                     <span className="text-xs font-black text-indigo-600">{financial.formatVisual((f.quantityNeeded || 0) * (f.unitPrice || 0), 'R$')}</span>
                                  </td>
                                  <td className="py-5">
                                     <input type="date" className="bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-400 outline-none" value={f.estimatedDate.split('T')[0]} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { estimatedDate: e.target.value }))} />
                                  </td>
                                  <td className="py-5">
                                    <div className="flex gap-1 justify-center">
                                       {/* Fix: StatusCircle defined below */}
                                       <StatusCircle active={f.status === 'pending'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'pending' }))} icon={<AlertCircle size={12}/>} color="amber" label="Pendente" />
                                       <StatusCircle active={f.status === 'ordered'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'ordered' }))} icon={<ShoppingCart size={12}/>} color="blue" label="Comprado" />
                                       <StatusCircle active={f.status === 'delivered'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'delivered' }))} icon={<Truck size={12}/>} color="emerald" label="No Local" />
                                    </div>
                                  </td>
                                  <td className="py-5 text-right pr-6 rounded-r-[1.5rem]">
                                    <div className="flex items-center justify-end gap-2">
                                      {f.status !== 'delivered' && (
                                        <button 
                                          onClick={() => setConfirmingForecast(f)}
                                          className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1.5 border border-indigo-100 dark:border-indigo-800"
                                        >
                                          <ArrowUpRight size={14}/> Efetivar
                                        </button>
                                      )}
                                      <button onClick={() => onUpdatePlanning(planningService.deleteForecast(planning, f.id))} className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-lg"><Trash2 size={16}/></button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      )}
                    </Droppable>
                  </table>
                </div>
            </div>
          </div>
        )}
      </DragDropContext>

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
             /* Fix: CalendarView defined below */
             <CalendarView milestones={planning.milestones} onEdit={setEditingMilestone} />
           )}
        </div>
      )}

      {/* MODAIS */}
      {isAddingForecast && (
        <ForecastAddModal 
          onClose={() => setIsAddingForecast(false)}
          allWorkItems={allWorkItems}
          onSave={(data: any) => {
            onUpdatePlanning(planningService.addForecast(planning, data));
            setIsAddingForecast(false);
          }}
        />
      )}

      {(editingTask || isAddingTask) && (
        /* Fix: TaskModal defined below */
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
        /* Fix: MilestoneModal defined below */
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

      {confirmingForecast && (
        /* Fix: ConfirmForecastModal defined below */
        <ConfirmForecastModal 
          forecast={confirmingForecast} 
          onClose={() => setConfirmingForecast(null)} 
          onConfirm={(parentId: string | null) => handleFinalizePurchase(confirmingForecast, parentId)}
          financialCategories={financialCategories}
        />
      )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

// Fix: Adicionado componente SubTabBtn para alternar abas de planejamento
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

// Fix: Adicionado componente ForecastKpi para os cards de estatísticas de suprimentos
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

// Fix: Adicionado componente StatusCircle para os toggles de status dos suprimentos
const StatusCircle = ({ active, onClick, icon, color, label }: any) => {
  const colors: any = {
    amber: active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400',
    blue: active ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400',
    emerald: active ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
  };
  return (
    <button onClick={onClick} className={`p-2 rounded-full transition-all group relative ${colors[color]}`}>
      {icon}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[8px] font-black uppercase rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {label}
      </span>
    </button>
  );
};

// Fix: Adicionado componente CalendarView para visualização do cronograma
const CalendarView = ({ milestones, onEdit }: { milestones: Milestone[], onEdit: (m: Milestone) => void }) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-center py-20 text-slate-300 flex-col gap-4">
        <CalendarDays size={48} className="opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] max-w-xs text-center leading-relaxed">
          A visualização de calendário está sendo otimizada para dispositivos móveis. Utilize a visão de lista para gestão imediata das metas.
        </p>
      </div>
    </div>
  );
};

// Fix: Adicionado componente TaskModal para criação/edição de tarefas
const TaskModal = ({ task, initialStatus, onClose, onSave }: any) => {
  const [desc, setDesc] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || initialStatus || 'todo');
  const [date, setDate] = useState(task?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{task ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
        <div className="space-y-4">
          <textarea autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold outline-none focus:border-indigo-500" value={desc} onChange={e => setDesc(e.target.value)} placeholder="O que precisa ser feito?" />
          <div className="grid grid-cols-2 gap-4">
            <select className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold" value={status} onChange={e => setStatus(e.target.value as any)}>
              <option value="todo">Planejado</option>
              <option value="doing">Executando</option>
              <option value="done">Concluído</option>
            </select>
            <input type="date" className="px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ description: desc, status, dueDate: date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Salvar</button>
        </div>
      </div>
    </div>
  );
};

// Fix: Adicionado componente MilestoneModal para metas do cronograma
const MilestoneModal = ({ milestone, onClose, onSave }: any) => {
  const [title, setTitle] = useState(milestone?.title || '');
  const [date, setDate] = useState(milestone?.date?.split('T')[0] || new Date().toISOString().split('T')[0]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-black mb-6 dark:text-white uppercase tracking-tight">{milestone ? 'Editar Meta' : 'Nova Meta'}</h2>
        <div className="space-y-4">
          <input autoFocus className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold" value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da Meta" />
          <input type="date" className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-8">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onSave({ title, date })} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Salvar</button>
        </div>
      </div>
    </div>
  );
};

// Fix: Adicionado componente ConfirmForecastModal para efetivar compra de suprimentos
const ConfirmForecastModal = ({ forecast, onClose, onConfirm, financialCategories }: any) => {
  const [parentId, setParentId] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 mb-6">
           <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Wallet size={24}/></div>
           <div>
             <h2 className="text-xl font-black dark:text-white uppercase">Efetivar Compra</h2>
             <p className="text-[10px] text-slate-400 font-bold uppercase">Integrar ao Fluxo Financeiro</p>
           </div>
        </div>
        <div className="space-y-4 mb-8">
           <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Você está registrando a compra de <strong>{forecast.description}</strong> no valor de <strong>{financial.formatVisual((forecast.quantityNeeded || 0) * (forecast.unitPrice || 0), 'R$')}</strong>.</p>
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Grupo de Despesa Alvo</label>
              <select className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold outline-none" value={parentId || ''} onChange={e => setParentId(e.target.value || null)}>
                 <option value="">Sem grupo (Raiz)</option>
                 {financialCategories.map((c: any) => <option key={c.id} value={c.id}>{c.description}</option>)}
              </select>
           </div>
        </div>
        <div className="flex gap-3">
           <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
           <button onClick={() => onConfirm(parentId)} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Confirmar e Lançar</button>
        </div>
      </div>
    </div>
  );
};
