
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, WorkItem, ItemType, GlobalSettings, MeasurementSnapshot } from '../types';
import { WbsView } from './WbsView';
import { StatsView } from './StatsView';
import { BrandingView } from './BrandingView';
import { ExpenseManager } from './ExpenseManager';
import { AssetManager } from './AssetManager';
import { PlanningView } from './PlanningView';
import { JournalView } from './JournalView';
import { PrintReport } from './PrintReport';
import { WorkItemModal } from './WorkItemModal';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';
import { planningService } from '../services/planningService';
import { financial } from '../utils/math';
import { 
  Layers, BarChart3, Coins, FileText, Sliders, 
  Undo2, Redo2, Lock, Calendar, BookOpen,
  CheckCircle2, ArrowRight, History, ChevronDown, LockOpen, Target, HardHat,
  RotateCcw, AlertTriangle, X as CloseIcon, Edit2
} from 'lucide-react';

interface ProjectWorkspaceProps {
  project: Project;
  globalSettings: GlobalSettings;
  onUpdateProject: (data: Partial<Project>) => void;
  onCloseMeasurement: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project, globalSettings, onUpdateProject, onCloseMeasurement, canUndo, canRedo, onUndo, onRedo
}) => {
  const [tab, setTab] = useState<'wbs' | 'stats' | 'expenses' | 'planning' | 'journal' | 'documents' | 'branding'>('wbs');
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [showConfirmReopen, setShowConfirmReopen] = useState(false);
  
  const [localName, setLocalName] = useState(project.name);
  
  const [modalType, setModalType] = useState<ItemType>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  useEffect(() => {
    setLocalName(project.name);
  }, [project.name]);

  // Lógica de Drag-to-Scroll Refinada
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef({ isDragging: false, startX: 0, scrollLeft: 0, totalDelta: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    dragInfo.current = {
      isDragging: true,
      startX: e.pageX - scrollRef.current.offsetLeft,
      scrollLeft: scrollRef.current.scrollLeft,
      totalDelta: 0
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo.current.isDragging || !scrollRef.current) return;
    
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragInfo.current.startX);
    dragInfo.current.totalDelta = Math.abs(walk);
    
    // Só move o scroll se o delta for significativo para evitar micro-movimentos que anulam o clique
    if (dragInfo.current.totalDelta > 5) {
      scrollRef.current.scrollLeft = dragInfo.current.scrollLeft - walk;
    }
  };

  const onMouseUpOrLeave = () => {
    dragInfo.current.isDragging = false;
  };

  // Previne o clique se o usuário estiver arrastando
  const handleTabClick = (e: React.MouseEvent, targetTab: typeof tab) => {
    if (dragInfo.current.totalDelta > 10) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setTab(targetTab);
  };

  const activeItems = useMemo(() => {
    if (viewingHistoryIndex === null) return project.items;
    return project.history[viewingHistoryIndex].items;
  }, [project, viewingHistoryIndex]);

  const printData = useMemo(() => {
    const tree = treeService.buildTree<WorkItem>(activeItems);
    const processed = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set<string>(activeItems.map(i => i.id));
    const flattened = treeService.flattenTree(processed, allIds);
    const stats = treeService.calculateBasicStats(activeItems, project.bdi, project);
    return { flattened, stats };
  }, [activeItems, project, project.bdi]);

  const isViewingHistory = viewingHistoryIndex !== null;

  const canCloseMeasurement = useMemo(() => {
    return !isViewingHistory && project.items.some(it => it.type === 'item' && (it.currentQuantity !== 0 || it.currentTotal !== 0));
  }, [isViewingHistory, project.items]);

  const processedCategories = useMemo(() => {
    return printData.flattened.filter(item => item.type === 'category');
  }, [printData.flattened]);

  const handleOpenModal = (type: ItemType, item: WorkItem | null, parentId: string | null) => {
    if (isViewingHistory) return; 
    setModalType(type);
    setEditingItem(item);
    setTargetParentId(parentId);
    setIsModalOpen(true);
  };

  const handleUpdateItemsWithCleanup = (newItems: WorkItem[]) => {
    if (isViewingHistory) return;
    const cleanedPlanning = planningService.cleanupOrphanedTasks(project.planning, newItems);
    onUpdateProject({ items: newItems, planning: cleanedPlanning });
  };

  const handleNameBlur = () => {
    if (localName.trim() && localName !== project.name) {
      onUpdateProject({ name: localName.trim() });
    } else {
      setLocalName(project.name);
    }
  };

  const handleReopenMeasurement = () => {
    const reopenedProject = projectService.reopenLatestMeasurement(project);
    onUpdateProject(reopenedProject);
    setViewingHistoryIndex(null);
    setShowConfirmReopen(false);
  };

  const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shrink-0 select-none pointer-events-auto ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
    >
      {icon} <span>{label}</span>
    </button>
  );

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden no-print">
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col shrink-0 z-40">
          
          <div className="flex flex-col md:flex-row items-center justify-between px-6 md:px-10 py-4 gap-4">
            <div className="flex-1 min-w-0 group relative w-full md:w-auto">
              <input 
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                className="w-full bg-transparent border-none text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight outline-none hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl px-3 -ml-3 transition-all truncate"
                placeholder="Nome da Obra..."
              />
              <Edit2 size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block" />
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button disabled={!canUndo || isViewingHistory} onClick={onUndo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Undo2 size={16}/></button>
                <button disabled={!canRedo || isViewingHistory} onClick={onRedo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Redo2 size={16}/></button>
              </div>
              
              {!isViewingHistory && (
                <button 
                  disabled={!canCloseMeasurement}
                  onClick={() => setShowConfirmClose(true)} 
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 ${canCloseMeasurement ? 'bg-indigo-600 text-white shadow-indigo-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'}`}
                >
                  <Lock size={14}/> <span>Fechar Medição</span>
                </button>
              )}

              {isViewingHistory && (
                <div className="flex items-center gap-2 px-6 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-amber-200 dark:border-amber-800 shadow-sm">
                  <History size={14}/> <span>Arquivo Histórico</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center px-6 md:px-10 pb-3 gap-4">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner shrink-0">
              <select 
                className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none px-3 py-1 cursor-pointer"
                value={viewingHistoryIndex === null ? 'current' : viewingHistoryIndex}
                onChange={(e) => {
                  const val = e.target.value;
                  setViewingHistoryIndex(val === 'current' ? null : parseInt(val));
                  setTab('wbs');
                }}
              >
                <option value="current">Medição Nº {project.measurementNumber} (ABERTO)</option>
                {(project.history || []).map((snap, idx) => (
                  <option key={idx} value={idx}>Medição Nº {snap.measurementNumber} (FECHADA)</option>
                ))}
              </select>
              <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${isViewingHistory ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
            </div>

            <div className="relative group flex-1 min-w-0">
              <div 
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUpOrLeave}
                onMouseLeave={onMouseUpOrLeave}
                className="w-full overflow-x-auto no-scrollbar py-1 cursor-grab active:cursor-grabbing scroll-smooth flex touch-pan-x"
              >
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner whitespace-nowrap flex-nowrap min-w-max gap-1">
                  <TabBtn active={tab === 'wbs'} onClick={(e: any) => handleTabClick(e, 'wbs')} label="Planilha" icon={<Layers size={14}/>} />
                  <TabBtn active={tab === 'stats'} onClick={(e: any) => handleTabClick(e, 'stats')} label="Análise" icon={<BarChart3 size={14}/>} />
                  <TabBtn active={tab === 'expenses'} onClick={(e: any) => handleTabClick(e, 'expenses')} label="Financeiro" icon={<Coins size={14}/>} />
                  <TabBtn active={tab === 'planning'} onClick={(e: any) => handleTabClick(e, 'planning')} label="Planejamento" icon={<Calendar size={14}/>} />
                  <TabBtn active={tab === 'journal'} onClick={(e: any) => handleTabClick(e, 'journal')} label="Diário" icon={<BookOpen size={14}/>} />
                  <TabBtn active={tab === 'documents'} onClick={(e: any) => handleTabClick(e, 'documents')} label="Docs" icon={<FileText size={14}/>} />
                  <TabBtn active={tab === 'branding'} onClick={(e: any) => handleTabClick(e, 'branding')} label="Ajustes" icon={<Sliders size={14}/>} />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-10 bg-slate-50 dark:bg-slate-950">
          {isViewingHistory && (
            <div className="max-w-[1600px] mx-auto mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex flex-col md:flex-row items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-sm gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                  <History size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight leading-tight">Snapshot: Medição Nº {project.history[viewingHistoryIndex].measurementNumber}</h4>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">Congelado em {project.history[viewingHistoryIndex].date} • Somente Leitura</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {viewingHistoryIndex === 0 && (
                  <button 
                    onClick={() => setShowConfirmReopen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-rose-50 dark:bg-rose-900/20 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100 dark:border-rose-800"
                  >
                    <RotateCcw size={14} /> Reabrir para Correção
                  </button>
                )}
                <button 
                  onClick={() => setViewingHistoryIndex(null)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                >
                  <LockOpen size={14} /> Voltar para Edição Atual
                </button>
              </div>
            </div>
          )}

          <div className="max-w-[1600px] mx-auto">
            {tab === 'wbs' && (
              <WbsView 
                project={{...project, items: activeItems}} 
                onUpdateProject={data => {
                  if (data.items) handleUpdateItemsWithCleanup(data.items);
                  else onUpdateProject(data);
                }} 
                onOpenModal={handleOpenModal} 
                isReadOnly={isViewingHistory}
              />
            )}
            {tab === 'stats' && <StatsView project={project} />}
            {tab === 'expenses' && (
              <ExpenseManager 
                project={project}
                expenses={project.expenses} 
                onAdd={e => onUpdateProject({ expenses: [...project.expenses, e] })} 
                onAddMany={newList => onUpdateProject({ expenses: [...project.expenses, ...newList] })}
                onUpdate={(id, d) => onUpdateProject({ expenses: project.expenses.map(ex => ex.id === id ? {...ex, ...d} : ex) })} 
                onDelete={id => onUpdateProject({ expenses: project.expenses.filter(ex => ex.id !== id) })} 
                workItems={project.items} 
                measuredValue={financial.sum(project.items.map(it => it.accumulatedTotal || 0))}
                onUpdateExpenses={newExpenses => onUpdateProject({ expenses: newExpenses })}
              />
            )}
            {tab === 'planning' && (
              <PlanningView 
                project={project} 
                onUpdatePlanning={p => onUpdateProject({ planning: p })} 
                onAddExpense={e => onUpdateProject({ expenses: [...project.expenses, e] })}
                categories={processedCategories as any} 
                allWorkItems={project.items}
              />
            )}
            {tab === 'journal' && (
              <JournalView 
                project={project}
                onUpdateJournal={j => onUpdateProject({ journal: j })}
                allWorkItems={project.items}
              />
            )}
            {tab === 'documents' && (
              <AssetManager 
                assets={project.assets} 
                onAdd={a => onUpdateProject({ assets: [...project.assets, a] })} 
                onDelete={id => onUpdateProject({ assets: project.assets.filter(as => as.id !== id) })} 
              />
            )}
            {tab === 'branding' && (
              <BrandingView 
                project={project} 
                onUpdateProject={onUpdateProject} 
              />
            )}
          </div>
        </div>
      </div>

      <PrintReport 
        project={project} 
        companyName={project.companyName || globalSettings.defaultCompanyName}
        companyCnpj={project.companyCnpj || globalSettings.companyCnpj}
        data={printData.flattened} 
        expenses={project.expenses} 
        stats={printData.stats as any} 
      />

      {showConfirmClose && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <Lock size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Efetivar Medição Nº {project.measurementNumber}?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed px-4">
              Esta ação irá consolidar <strong>{financial.formatBRL(printData.stats.current)}</strong> medidos no período. Os saldos serão rotacionados e a planilha será zerada para a próxima medição.
            </p>

            <div className="grid grid-cols-1 gap-3 mb-8">
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-left">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-indigo-500 shadow-sm"><ArrowRight size={16}/></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Próxima Etapa</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 italic">O Acumulado Total atual passará a ser o saldo "Anterior" da Medição Nº {project.measurementNumber + 1}.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 text-left">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-emerald-500 shadow-sm"><CheckCircle2 size={16}/></div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Rastreabilidade</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200 italic">Um snapshot imutável será gerado para consulta no seletor de períodos.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowConfirmClose(false)} 
                className="flex-1 py-4 px-6 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => { onCloseMeasurement(); setShowConfirmClose(false); }} 
                className="flex-1 py-4 px-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
              >
                Confirmar e Rotacionar
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmReopen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 text-center">
            <div className="w-20 h-20 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <RotateCcw size={36} />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Reabrir Medição Nº {project.history[0].measurementNumber}?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 leading-relaxed px-4">
              <strong>CUIDADO:</strong> Se você já iniciou a digitação de dados na medição atual (Nº {project.measurementNumber}), esses dados serão <strong>PERDIDOS</strong> para restaurar o estado da medição anterior.
            </p>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 text-left mb-8 flex gap-3">
               <AlertTriangle className="text-amber-500 shrink-0" size={20} />
               <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 leading-tight">
                 Use esta função apenas para corrigir glosas ou erros de digitação apontados pela fiscalização. Após a correção, você deverá fechar a medição novamente.
               </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowConfirmReopen(false)} 
                className="flex-1 py-4 px-6 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                Desistir
              </button>
              <button 
                onClick={handleReopenMeasurement} 
                className="flex-1 py-4 px-6 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
              >
                Sim, Restaurar para Edição
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <WorkItemModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={(data) => {
            if (editingItem) {
              handleUpdateItemsWithCleanup(project.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it));
            } else {
              const newItem: WorkItem = {
                id: crypto.randomUUID(), 
                parentId: targetParentId, 
                name: data.name || 'Novo Registro', 
                type: data.type || modalType, 
                wbs: '', 
                order: project.items.filter(i => i.parentId === targetParentId).length,
                unit: data.unit || 'un', 
                contractQuantity: data.unit === 'un' ? (data.contractQuantity || 0) : (data.contractQuantity || 0),
                unitPrice: 0, 
                unitPriceNoBdi: data.unitPriceNoBdi || 0, 
                contractTotal: 0,
                previousQuantity: 0, 
                previousTotal: 0, 
                currentQuantity: 0, 
                currentTotal: 0, 
                currentPercentage: 0,
                accumulatedQuantity: 0, 
                accumulatedTotal: 0, 
                accumulatedPercentage: 0, 
                balanceQuantity: 0, 
                balanceTotal: 0,
                ...data 
              };
              handleUpdateItemsWithCleanup([...project.items, newItem]);
            }
          }} 
          editingItem={editingItem} type={modalType} 
          categories={processedCategories as any} 
          projectBdi={project.bdi} 
        />
      )}
    </>
  );
};
