
import React, { useState, useMemo } from 'react';
import { Project, PlanningTask, MaterialForecast, Milestone, WorkItem, TaskStatus, ProjectPlanning, ProjectExpense } from '../types';
import { planningService } from '../services/planningService';
import { financial } from '../utils/math';
import { 
  CheckCircle2, Circle, Clock, Package, Flag, Plus, 
  Trash2, Calendar, AlertCircle, ShoppingCart, Truck, Search,
  Wand2, ArrowUpRight, Ban, ListChecks, Boxes, Target,
  GripVertical, MoreVertical, Edit2, X, Save, Calculator, Wallet, Link,
  ChevronUp, ChevronDown, List, CalendarDays, Filter
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
  const [isAddingTask, setIsAddingTask] = useState<TaskStatus | null>(null);
  
  // States for Milestones
  const [milestoneView, setMilestoneView] = useState<'list' | 'calendar'>('list');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // States for Forecast Filters
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
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as TaskStatus;
    const updated = planningService.updateTask(planning, draggableId, { status: newStatus });
    onUpdatePlanning(updated);
  };

  const handleAddTask = (data: Partial<PlanningTask>) => {
    const updated = planningService.addTask(planning, data);
    onUpdatePlanning(updated);
    setIsAddingTask(null);
  };

  // Fix: Added handleUpdateTask to resolve "Cannot find name 'handleUpdateTask'" error
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

  const columns: { id: TaskStatus, label: string, color: string }[] = [
    { id: 'todo', label: 'Planejado', color: 'indigo' },
    { id: 'doing', label: 'Executando', color: 'amber' },
    { id: 'done', label: 'Concluído', color: 'emerald' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20">
            <Calendar size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Planejamento Operacional</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Gestão Ágil de Canteiro</p>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
          <SubTabBtn active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} label="Quadro Kanban" icon={<ListChecks size={14}/>} />
          <SubTabBtn active={activeSubTab === 'forecast'} onClick={() => setActiveSubTab('forecast')} label="Suprimentos" icon={<Boxes size={14}/>} />
          <SubTabBtn active={activeSubTab === 'milestones'} onClick={() => setActiveSubTab('milestones')} label="Cronograma" icon={<Target size={14}/>} />
        </div>
      </div>

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

          <DragDropContext onDragEnd={onDragEnd}>
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
          </DragDropContext>
        </div>
      )}

      {activeSubTab === 'forecast' && (
        <div className="space-y-8 animate-in fade-in">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={14} />
                    <input 
                      placeholder="Filtrar materiais..."
                      className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all w-64"
                      value={forecastSearch}
                      onChange={e => setForecastSearch(e.target.value)}
                    />
                  </div>
                  <select 
                    className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-indigo-500 appearance-none pr-10 relative"
                    value={forecastStatusFilter}
                    onChange={e => setForecastStatusFilter(e.target.value as any)}
                  >
                    <option value="all">Todos Status</option>
                    <option value="pending">Pendente</option>
                    <option value="ordered">Comprado</option>
                    <option value="delivered">No Local</option>
                  </select>
                  <button onClick={() => onUpdatePlanning(planningService.addForecast(planning, { description: 'Novo Insumo' }))} className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
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
                  <tbody className="text-center">
                    {sortedForecasts.map(f => (
                      <tr key={f.id} className="group bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-transparent hover:border-emerald-200 transition-all">
                        <td className="py-5 pl-4 rounded-l-[1.5rem]">
                           <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    ))}
                  </tbody>
                </table>
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
                  {planning.milestones.length === 0 && <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px]">Sem metas definidas</div>}
                </div>
             </div>
           ) : (
             <CalendarView milestones={planning.milestones} onEdit={setEditingMilestone} />
           )}
        </div>
      )}

      {/* MODAIS DE CRUD */}
      {(editingTask || isAddingTask) && (
        <TaskModal 
          task={editingTask} 
          initialStatus={isAddingTask}
          onClose={() => { setEditingTask(null); setIsAddingTask(null); }} 
          onSave={(data: Partial<PlanningTask>) => {
            if (editingTask) {
              handleUpdateTask(editingTask.id, data);
            } else {
              handleAddTask(data);
            }
            setEditingTask(null);
            setIsAddingTask(null);
          }}
          onDelete={() => {
            if (editingTask) onUpdatePlanning(planningService.deleteTask(planning, editingTask.id));
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
            if (editingMilestone) {
              onUpdatePlanning(planningService.updateMilestone(planning, editingMilestone.id, data));
            } else {
              onUpdatePlanning(planningService.addMilestone(planning, data));
            }
            setEditingMilestone(null);
            setIsAddingMilestone(false);
          }}
        />
      )}

      {confirmingForecast && (
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

// COMPONENTE CALENDÁRIO SIMPLIFICADO
const CalendarView = ({ milestones, onEdit }: { milestones: Milestone[], onEdit: (m: Milestone) => void }) => {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const now = new Date();
  const currentMonth = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
       {/* Fix: Resolved "Property 'Days' does not exist" error by fixing the typo in CalendarDays */}
       <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-8 border-b pb-4 flex items-center gap-2"><CalendarDays size={16}/> {currentMonth}</h3>
       <div className="grid grid-cols-7 gap-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-[9px] font-black uppercase text-slate-300 py-2">{d}</div>
          ))}
          {days.map(d => {
            const dayMilestones = milestones.filter(m => new Date(m.date).getDate() === d && new Date(m.date).getMonth() === now.getMonth());
            return (
              <div key={d} className="min-h-[100px] border border-slate-50 dark:border-slate-800 rounded-2xl p-2 bg-slate-50/30 dark:bg-slate-800/20 group hover:bg-white dark:hover:bg-slate-800 transition-colors">
                 <span className="text-[10px] font-black text-slate-300 group-hover:text-indigo-500 transition-colors">{d}</span>
                 <div className="mt-1 space-y-1">
                    {dayMilestones.map(m => (
                      <button 
                        key={m.id}
                        onClick={() => onEdit(m)}
                        className={`w-full text-left p-1.5 rounded-lg text-[8px] font-bold uppercase truncate transition-all ${m.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'}`}
                      >
                        {m.title}
                      </button>
                    ))}
                 </div>
              </div>
            );
          })}
       </div>
    </div>
  );
};

// MODAL PARA CRUD COMPLETO DA TAREFA
const TaskModal = ({ task, initialStatus, onClose, onSave, onDelete }: any) => {
  const [formData, setFormData] = useState({
    description: task?.description || '',
    dueDate: task?.dueDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: task?.status || initialStatus || 'todo'
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{task ? 'Editar Atividade' : 'Nova Atividade'}</h2>
           <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Descrição</label>
            <textarea 
              autoFocus
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-bold outline-none focus:border-indigo-500 transition-all resize-none h-32"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              placeholder="Descreva a atividade..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Vencimento</label>
               <input 
                 type="date"
                 className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black outline-none focus:border-indigo-500"
                 value={formData.dueDate}
                 onChange={e => setFormData({...formData, dueDate: e.target.value})}
               />
             </div>
             <div>
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Estado Atual</label>
               <select 
                 className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-black outline-none focus:border-indigo-500 appearance-none"
                 value={formData.status}
                 onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}
               >
                 <option value="todo">Pendente</option>
                 <option value="doing">Executando</option>
                 <option value="done">Concluído</option>
               </select>
             </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
           {task && (
             <button onClick={onDelete} className="flex items-center justify-center gap-2 px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex-1">
               <Trash2 size={16}/> Excluir
             </button>
           )}
           <button 
             onClick={() => onSave(formData)} 
             disabled={!formData.description}
             className="flex items-center justify-center gap-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex-1 disabled:opacity-50"
           >
             <Save size={16}/> {task ? 'Salvar Alterações' : 'Criar Atividade'}
           </button>
        </div>
      </div>
    </div>
  );
};

// MODAL PARA CRUD DE MILSTONE
const MilestoneModal = ({ milestone, onClose, onSave }: any) => {
  const [formData, setFormData] = useState({
    title: milestone?.title || '',
    date: milestone?.date?.split('T')[0] || new Date().toISOString().split('T')[0],
    isCompleted: milestone?.isCompleted || false
  });

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
           <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">{milestone ? 'Editar Meta' : 'Nova Meta Crítica'}</h2>
           <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"><X size={20}/></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Título da Meta</label>
            <input 
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white text-sm font-black outline-none focus:border-indigo-500"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="Ex: Entrega da Laje do 2º Pavimento"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Data Prevista</label>
            <input 
              type="date"
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>
          <button 
            onClick={() => setFormData({...formData, isCompleted: !formData.isCompleted})}
            className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.isCompleted ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
          >
            {formData.isCompleted ? <CheckCircle2 size={20}/> : <Circle size={20}/>}
            <span className="text-[10px] font-black uppercase">Marcar como Finalizada</span>
          </button>
        </div>

        <button 
          onClick={() => onSave(formData)} 
          disabled={!formData.title}
          className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
        >
          {milestone ? 'Salvar Alterações' : 'Adicionar ao Cronograma'}
        </button>
      </div>
    </div>
  );
};

const ConfirmForecastModal = ({ forecast, onClose, onConfirm, financialCategories }: any) => {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Link size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-white text-center mb-2 tracking-tight">Vincular Compra ao Financeiro</h2>
        <p className="text-slate-500 text-sm text-center mb-8 px-4 leading-relaxed">
          Você está efetivando a compra de <strong>{forecast.description}</strong>. <br/> Escolha em qual categoria do **Fluxo de Caixa** este gasto deve ser lançado.
        </p>

        <div className="space-y-4 mb-8">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Centro de Custo (Financeiro)</label>
           <select 
             className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-black outline-none focus:border-indigo-500 transition-all appearance-none"
             value={selectedParentId || ''}
             onChange={e => setSelectedParentId(e.target.value || null)}
           >
             <option value="">Lançamento Avulso (Sem Categoria)</option>
             {financialCategories.map((cat: any) => (
               <option key={cat.id} value={cat.id}>
                 {cat.wbs} - {cat.description || cat.name}
               </option>
             ))}
           </select>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl">Cancelar</button>
          <button 
            onClick={() => onConfirm(selectedParentId)} 
            className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
          >
            Confirmar Efetivação
          </button>
        </div>
      </div>
    </div>
  );
};

const SubTabBtn = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>{icon} {label}</button>
);

const ForecastKpi = ({ label, value, icon, color, sub }: any) => {
  const colors: any = { 
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800', 
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', 
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colors[color]}`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div>
        <p className={`text-2xl font-black tracking-tighter ${colors[color].split(' ')[0]}`}>{financial.formatVisual(value, 'R$')}</p>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
};

const StatusCircle = ({ active, onClick, icon, color, label }: any) => {
  const colors: any = { 
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', 
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', 
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
  };
  return (
    <button onClick={onClick} className={`p-2 rounded-xl border transition-all flex items-center gap-2 ${active ? colors[color] + ' shadow-inner scale-105' : 'text-slate-300 border-slate-100 dark:border-slate-800 hover:text-slate-400'}`} title={label}>
      {icon}
      {active && <span className="text-[8px] font-black uppercase pr-1">{label}</span>}
    </button>
  );
};
