
import React, { useState, useMemo } from 'react';
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
import { planningService } from '../services/planningService';
import { financial } from '../utils/math';
import { 
  Layers, BarChart3, Coins, FileText, Sliders, 
  Printer, Undo2, Redo2, Lock, Calendar, BookOpen,
  CheckCircle2, ArrowRight, History, ChevronDown, LockOpen, Target, HardHat
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
  // Sequência de abas atualizada conforme solicitação: Planilha, Analise, Financeiro, Planejamento, Diário, Docs, Ajustes
  const [tab, setTab] = useState<'wbs' | 'stats' | 'expenses' | 'planning' | 'journal' | 'documents' | 'branding'>('wbs');
  
  // Controle de Navegação por Histórico
  const [viewingHistoryIndex, setViewingHistoryIndex] = useState<number | null>(null);
  
  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  
  const [modalType, setModalType] = useState<ItemType>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // Determina quais itens exibir (os atuais ou os de um snapshot histórico)
  const activeItems = useMemo(() => {
    if (viewingHistoryIndex === null) return project.items;
    return project.history[viewingHistoryIndex].items;
  }, [project, viewingHistoryIndex]);

  // Calcula estatísticas para o período selecionado
  const printData = useMemo(() => {
    const tree = treeService.buildTree(activeItems);
    const processed = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set(activeItems.map(i => i.id));
    const flattened = treeService.flattenTree(processed, allIds);
    const stats = treeService.calculateBasicStats(activeItems, project.bdi);
    return { flattened, stats };
  }, [activeItems, project.bdi]);

  const isViewingHistory = viewingHistoryIndex !== null;

  // Habilitar botão fechar apenas na medição atual e se houver produção
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

  const TabBtn = ({ active, onClick, label, icon }: any) => (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
    >
      {icon} <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden no-print">
        {/* HEADER PRINCIPAL */}
        <header className="min-h-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between px-6 md:px-10 py-4 md:py-0 shrink-0 z-40 gap-4">
          <div className="flex flex-col gap-1 overflow-hidden text-left">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[150px]">{project.name}</span>
              
              {/* SELETOR DE PERÍODO (TIME MACHINE) */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                <select 
                  className="bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none px-3 py-1 cursor-pointer"
                  value={viewingHistoryIndex === null ? 'current' : viewingHistoryIndex}
                  onChange={(e) => {
                    const val = e.target.value;
                    setViewingHistoryIndex(val === 'current' ? null : parseInt(val));
                    setTab('wbs');
                  }}
                >
                  <option value="current">Medição Nº {project.measurementNumber} (EM ABERTO)</option>
                  {(project.history || []).map((snap, idx) => (
                    <option key={idx} value={idx}>Medição Nº {snap.measurementNumber} (FECHADA)</option>
                  ))}
                </select>
                <div className={`w-2 h-2 rounded-full mr-2 ${isViewingHistory ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              </div>
            </div>

            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1 mt-1">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner whitespace-nowrap">
                <TabBtn active={tab === 'wbs'} onClick={() => setTab('wbs')} label="Planilha" icon={<Layers size={14}/>} />
                <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} label="Análise" icon={<BarChart3 size={14}/>} />
                <TabBtn active={tab === 'expenses'} onClick={() => setTab('expenses')} label="Financeiro" icon={<Coins size={14}/>} />
                <TabBtn active={tab === 'planning'} onClick={() => setTab('planning')} label="Planejamento" icon={<Calendar size={14}/>} />
                <TabBtn active={tab === 'journal'} onClick={() => setTab('journal')} label="Diário" icon={<BookOpen size={14}/>} />
                <TabBtn active={tab === 'documents'} onClick={() => setTab('documents')} label="Docs" icon={<FileText size={14}/>} />
                <TabBtn active={tab === 'branding'} onClick={() => setTab('branding')} label="Ajustes" icon={<Sliders size={14}/>} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button disabled={!canUndo || isViewingHistory} onClick={onUndo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Undo2 size={16}/></button>
              <button disabled={!canRedo || isViewingHistory} onClick={onRedo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Redo2 size={16}/></button>
            </div>
            <button onClick={() => window.print()} title="Gerar PDF" className="p-3 text-white bg-slate-900 dark:bg-slate-700 hover:scale-105 active:scale-95 rounded-2xl transition-all shadow-lg"><Printer size={18}/></button>
            
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
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-10 bg-slate-50 dark:bg-slate-950">
          {/* BANNER DE AVISO DE HISTÓRICO */}
          {isViewingHistory && (
            <div className="max-w-[1600px] mx-auto mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-3xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20">
                  <History size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-tight leading-tight">Snapshot: Medição Nº {project.history[viewingHistoryIndex].measurementNumber}</h4>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">Congelado em {project.history[viewingHistoryIndex].date} • Somente Leitura</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingHistoryIndex(null)}
                className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 rounded-xl hover:bg-amber-100 dark:hover:bg-slate-700 transition-all shadow-sm border border-amber-100 dark:border-amber-800"
              >
                <LockOpen size={14} /> Voltar para Edição Atual
              </button>
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
        companyName={globalSettings.defaultCompanyName}
        companyCnpj={globalSettings.companyCnpj}
        data={printData.flattened} 
        expenses={project.expenses} 
        stats={printData.stats as any} 
      />

      {/* MODAL DE CONFIRMAÇÃO DE FECHAMENTO */}
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
