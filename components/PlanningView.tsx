
import React, { useState } from 'react';
import { Project, PlanningTask, MaterialForecast, Milestone, WorkItem, ForecastStatus, ProjectPlanning, ProjectExpense } from '../types';
import { planningService } from '../services/planningService';
import { financial } from '../utils/math';
import { 
  CheckCircle2, Circle, Clock, Package, Flag, Plus, 
  Trash2, Calendar, AlertCircle, ShoppingCart, Truck, Search,
  Wand2, ArrowUpRight, Ban, ListChecks, Boxes, Target
} from 'lucide-react';

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
  const planning = project.planning;

  // Handlers para Tarefas
  const handleAutoGenerate = () => {
    const updated = planningService.generateTasksFromWbs(planning, allWorkItems);
    onUpdatePlanning(updated);
  };

  const handleToggleTask = (task: PlanningTask) => {
    const updated = planningService.updateTask(planning, task.id, { isCompleted: !task.isCompleted });
    onUpdatePlanning(updated);
  };

  // Handlers para Suprimentos
  const handleConvertToExpense = (forecast: MaterialForecast) => {
    const expenseData = planningService.prepareExpenseFromForecast(forecast);
    onAddExpense(expenseData as ProjectExpense);
    
    // Atualiza status do forecast para rastrear que já foi faturado
    const updatedPlanning = planningService.updateForecast(planning, forecast.id, { status: 'ordered' });
    onUpdatePlanning(updatedPlanning);
  };

  const UrgencyBadge = ({ date }: { date: string }) => {
    const level = planningService.getUrgencyLevel(date);
    if (level === 'normal') return null;
    
    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse ${
        level === 'urgent' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
      }`}>
        <AlertCircle size={12} /> {level === 'urgent' ? 'Crítico' : 'Próximo'}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* HEADER DE NAVEGAÇÃO INTERNA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-indigo-600 rounded-[1.5rem] text-white shadow-xl shadow-indigo-500/20">
            <Calendar size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Painel de Planejamento</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Gestão Operacional e Suprimentos</p>
          </div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1">
          <SubTabBtn active={activeSubTab === 'tasks'} onClick={() => setActiveSubTab('tasks')} label="Checklist" icon={<ListChecks size={14}/>} />
          <SubTabBtn active={activeSubTab === 'forecast'} onClick={() => setActiveSubTab('forecast')} label="Suprimentos" icon={<Boxes size={14}/>} />
          <SubTabBtn active={activeSubTab === 'milestones'} onClick={() => setActiveSubTab('milestones')} label="Metas" icon={<Target size={14}/>} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* SEÇÃO 1: CHECKLIST DE TAREFAS (TO-DO) */}
        {activeSubTab === 'tasks' && (
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Atividades em Aberto</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Controle de frentes de serviço e ordens de campo.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleAutoGenerate} className="flex items-center gap-2 px-5 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 hover:text-white transition-all">
                  <Wand2 size={16} /> Analisar EAP
                </button>
                <button onClick={() => onUpdatePlanning(planningService.addTask(planning, 'Nova Atividade de Campo'))} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all">
                  <Plus size={16} /> Nova Tarefa
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              {planning.tasks.length === 0 ? (
                <EmptyPlaceholder label="Sem atividades agendadas no momento." />
              ) : (
                planning.tasks.map(task => (
                  <div key={task.id} className={`flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border transition-all group ${task.isCompleted ? 'border-emerald-200 opacity-60' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300'}`}>
                    <div className="flex items-center gap-6">
                      <button onClick={() => handleToggleTask(task)} className={`transition-all transform hover:scale-110 ${task.isCompleted ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                        {task.isCompleted ? <CheckCircle2 size={32}/> : <Circle size={32}/>}
                      </button>
                      <div className="flex flex-col gap-1.5">
                        <input 
                          className={`bg-transparent border-none text-base font-bold outline-none w-full max-w-xl ${task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}
                          value={task.description}
                          onChange={(e) => onUpdatePlanning(planningService.updateTask(planning, task.id, { description: e.target.value }))}
                        />
                        <div className="flex items-center gap-4">
                           <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                             <Clock size={12}/> Vence em: {financial.formatDate(task.dueDate)}
                           </span>
                           <UrgencyBadge date={task.dueDate} />
                           {task.categoryId && (
                             <span className="text-[9px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 px-2.5 py-1 rounded-lg">
                               EAP: Item Vinculado
                             </span>
                           )}
                           {task.completedAt && (
                             <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">
                               Concluído em {financial.formatDate(task.completedAt)}
                             </span>
                           )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => onUpdatePlanning(planningService.deleteTask(planning, task.id))} className="p-3 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20">
                      <Trash2 size={20}/>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SEÇÃO 2: QUADRO DE SUPRIMENTOS (ESTOQUE E COMPRAS) */}
        {activeSubTab === 'forecast' && (
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
             <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Previsão de Compras</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Gestão de insumos e matérias-primas antes do faturamento.</p>
              </div>
              <button onClick={() => onUpdatePlanning(planningService.addForecast(planning, { description: 'Novo Insumo' }))} className="flex items-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all">
                <Plus size={16} /> Adicionar Previsão
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    <th className="pb-4 pl-4">Material / Insumo</th>
                    <th className="pb-4">Demanda</th>
                    <th className="pb-4">Prazo Entrega</th>
                    <th className="pb-4">Status Atual</th>
                    <th className="pb-4 text-right pr-4">Fluxo Financeiro</th>
                  </tr>
                </thead>
                <tbody>
                  {planning.forecasts.map(f => (
                    <tr key={f.id} className="group bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-transparent hover:border-emerald-200 transition-all">
                      <td className="py-5 pl-6 rounded-l-[1.5rem]">
                        <input className="bg-transparent text-sm font-black dark:text-white outline-none w-full" value={f.description} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { description: e.target.value }))} />
                        <div className="mt-1.5"><UrgencyBadge date={f.estimatedDate} /></div>
                      </td>
                      <td className="py-5">
                        <div className="flex items-center gap-3">
                          <input type="number" className="w-20 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2 rounded-xl text-xs font-black text-indigo-600 outline-none shadow-sm" value={f.quantityNeeded} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { quantityNeeded: parseFloat(e.target.value) }))} />
                          <span className="text-[10px] font-black uppercase text-slate-400">{f.unit}</span>
                        </div>
                      </td>
                      <td className="py-5">
                         <input type="date" className="bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-400 outline-none" value={f.estimatedDate.split('T')[0]} onChange={e => onUpdatePlanning(planningService.updateForecast(planning, f.id, { estimatedDate: e.target.value }))} />
                      </td>
                      <td className="py-5">
                        <div className="flex gap-2">
                           <StatusCircle active={f.status === 'pending'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'pending' }))} icon={<AlertCircle size={14}/>} color="amber" label="Pendente" />
                           <StatusCircle active={f.status === 'ordered'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'ordered' }))} icon={<ShoppingCart size={14}/>} color="blue" label="Comprado" />
                           <StatusCircle active={f.status === 'delivered'} onClick={() => onUpdatePlanning(planningService.updateForecast(planning, f.id, { status: 'delivered' }))} icon={<Truck size={14}/>} color="emerald" label="No Local" />
                        </div>
                      </td>
                      <td className="py-5 text-right pr-6 rounded-r-[1.5rem]">
                        <div className="flex items-center justify-end gap-3">
                          {f.status !== 'delivered' && (
                            <button 
                              onClick={() => handleConvertToExpense(f)}
                              className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 border border-indigo-100 dark:border-indigo-800"
                              title="Criar lançamento real no financeiro"
                            >
                              <ArrowUpRight size={14}/> Efetivar Compra
                            </button>
                          )}
                          <button onClick={() => onUpdatePlanning(planningService.deleteForecast(planning, f.id))} className="p-2.5 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"><Trash2 size={18}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {planning.forecasts.length === 0 && <EmptyPlaceholder label="Sem insumos previstos." />}
            </div>
          </div>
        )}

        {/* SEÇÃO 3: LINHA DO TEMPO DE METAS (MILESTONES) */}
        {activeSubTab === 'milestones' && (
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Metas Críticas (Milestones)</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-1">Pontos de controle para medição de progresso contratual.</p>
              </div>
              <button onClick={() => onUpdatePlanning(planningService.addMilestone(planning, 'Nova Entrega Crítica', new Date().toISOString()))} className="flex items-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 transition-all">
                <Plus size={16} /> Nova Meta
              </button>
            </div>
            <div className="relative space-y-10 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-1 before:bg-slate-100 dark:before:bg-slate-800">
              {planning.milestones.map(m => (
                <div key={m.id} className="relative flex items-center justify-between pl-10">
                  <div className={`absolute left-0 w-7 h-7 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center transition-all shadow-md ${m.isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}>
                    <Flag size={12} className="text-white" />
                  </div>
                  <div className={`flex-1 ml-6 bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border transition-all flex items-center justify-between group ${m.isCompleted ? 'border-emerald-200' : 'border-slate-100 dark:border-slate-800'}`}>
                    <div className="flex flex-col gap-1">
                       <input className="bg-transparent text-base font-black dark:text-white outline-none w-full" value={m.title} onChange={e => onUpdatePlanning(planningService.updateMilestone(planning, m.id, { title: e.target.value }))} />
                       <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-2">
                         <Calendar size={14}/> {financial.formatDate(m.date)}
                       </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <button onClick={() => onUpdatePlanning(planningService.updateMilestone(planning, m.id, { isCompleted: !m.isCompleted }))} className={`text-[10px] font-black uppercase px-5 py-2 rounded-full border transition-all ${m.isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white dark:bg-slate-700 text-slate-400 border-slate-200 dark:border-slate-600'}`}>
                        {m.isCompleted ? 'Finalizada' : 'Em Aberto'}
                      </button>
                      <button onClick={() => onUpdatePlanning(planningService.deleteMilestone(planning, m.id))} className="p-2.5 text-slate-300 hover:text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl"><Trash2 size={20}/></button>
                    </div>
                  </div>
                </div>
              ))}
              {planning.milestones.length === 0 && <EmptyPlaceholder label="Sem metas definidas para este empreendimento." />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// COMPONENTES AUXILIARES
const SubTabBtn = ({ active, onClick, label, icon }: any) => (
  <button 
    onClick={onClick} 
    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
      active 
        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-xl shadow-slate-200/50 dark:shadow-none' 
        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
    }`}
  >
    {icon} <span>{label}</span>
  </button>
);

const EmptyPlaceholder = ({ label }: { label: string }) => (
  <div className="py-20 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 opacity-40 select-none">
    <Ban size={48} className="mb-4" />
    <p className="text-[11px] font-black uppercase tracking-[0.2em]">{label}</p>
  </div>
);

const StatusCircle = ({ active, onClick, icon, color, label }: any) => {
  const colors: any = { 
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800', 
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800', 
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' 
  };
  return (
    <button 
      onClick={onClick} 
      className={`p-3 rounded-2xl border transition-all flex items-center gap-2 group ${
        active ? colors[color] + ' shadow-inner scale-105' : 'text-slate-300 border-slate-100 dark:border-slate-800 hover:text-slate-400'
      }`}
      title={label}
    >
      {icon}
      {active && <span className="text-[9px] font-black uppercase pr-1">{label}</span>}
    </button>
  );
};
