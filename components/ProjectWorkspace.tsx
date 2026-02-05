
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, GlobalSettings, WorkItem, MeasurementSnapshot } from '../types';
import {
  Layers, BarChart3, Coins, Users, HardHat, BookOpen, FileText, Sliders,
  ChevronLeft, CheckCircle2, Printer, History, Calendar, Lock, ChevronDown,
  ArrowRight, Clock, Undo2, Redo2, RotateCcw
} from 'lucide-react';
import { WbsView } from './WbsView';
import { StatsView } from './StatsView';
import { ExpenseManager } from './ExpenseManager';
import { WorkforceManager } from './WorkforceManager';
import { PlanningView } from './PlanningView';
import { JournalView } from './JournalView';
import { AssetManager } from './AssetManager';
import { BrandingView } from './BrandingView';
import { WorkItemModal } from './WorkItemModal';
import { treeService } from '../services/treeService';
import { projectService } from '../services/projectService';

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

export type TabID = 'wbs' | 'stats' | 'expenses' | 'workforce' | 'planning' | 'journal' | 'documents' | 'branding';

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project, globalSettings, onUpdateProject, onCloseMeasurement,
  canUndo, canRedo, onUndo, onRedo
}) => {
  const [tab, setTab] = useState<TabID>('wbs');
  const [viewingMeasurementId, setViewingMeasurementId] = useState<'current' | number>('current');

  const tabsNavRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'item'>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsNavRef.current) return;
    dragStartRef.current = { x: e.pageX - tabsNavRef.current.offsetLeft, scrollLeft: tabsNavRef.current.scrollLeft, moved: false };
    setIsDraggingState(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStartRef.current || !tabsNavRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsNavRef.current.offsetLeft;
    const walk = (x - dragStartRef.current.x) * 1.5;
    if (Math.abs(x - dragStartRef.current.x) > 5) {
      dragStartRef.current.moved = true;
      setIsDraggingState(true);
      tabsNavRef.current.scrollLeft = dragStartRef.current.scrollLeft - walk;
    }
  };

  const handleMouseUpOrLeave = () => {
    setTimeout(() => { dragStartRef.current = null; setIsDraggingState(false); }, 50);
  };

  const displayData = useMemo(() => {
    if (viewingMeasurementId === 'current') return { items: project.items, isReadOnly: false, label: `Medição Nº ${project.measurementNumber}`, date: project.referenceDate };
    const snapshot = project.history?.find(h => h.measurementNumber === viewingMeasurementId);
    if (snapshot) return { items: snapshot.items, isReadOnly: true, label: `Medição Nº ${snapshot.measurementNumber}`, date: snapshot.date };
    return { items: project.items, isReadOnly: false, label: 'Erro', date: '' };
  }, [project, viewingMeasurementId]);

  const isHistoryMode = viewingMeasurementId !== 'current';

  const handleTabClick = (newTab: TabID) => {
    if (dragStartRef.current?.moved) return;
    setTab(newTab);
  };

  const handleOpenModal = (type: 'category' | 'item', item: WorkItem | null, parentId: string | null) => {
    if (displayData.isReadOnly) return;
    setModalType(type); setEditingItem(item); setTargetParentId(parentId); setIsModalOpen(true);
  };

  const handleSaveWorkItem = (data: Partial<WorkItem>) => {
    if (editingItem) {
      onUpdateProject({ items: project.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it) });
    } else {
      const newItem: WorkItem = {
        id: crypto.randomUUID(), parentId: targetParentId, name: data.name || '', type: modalType, wbs: '', order: project.items.length, unit: data.unit || 'un', cod: data.cod, fonte: data.fonte, contractQuantity: data.contractQuantity || 0, unitPrice: data.unitPrice || 0, unitPriceNoBdi: data.unitPriceNoBdi || 0, contractTotal: 0, previousQuantity: 0, previousTotal: 0, currentQuantity: 0, currentTotal: 0, currentPercentage: 0, accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0, balanceQuantity: 0, balanceTotal: 0,
      };
      onUpdateProject({ items: [...project.items, newItem] });
    }
  };

  const handleReopenMeasurement = () => {
    if (window.confirm("Atenção: Ao reabrir a última medição, o snapshot atual será removido e as quantidades voltaram para o estado anterior ao fechamento. Continuar?")) {
      const updated = projectService.reopenLatestMeasurement(project);
      onUpdateProject(updated);
    }
  };

  const TabBtn: React.FC<{ active: boolean; id: TabID; label: string; icon: React.ReactNode }> = ({ active, id, label, icon }) => (
    <button onMouseUp={() => handleTabClick(id)} className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 select-none cursor-pointer ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-800'} ${isDraggingState ? 'pointer-events-none' : ''}`}>
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">

      {/* 1. HEADER DE CONTEXTO */}
      <header className={`no-print border-b p-6 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-6 z-40 transition-colors ${isHistoryMode ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
        <div className="flex items-center gap-4 min-w-0">
          <div className={`p-3 rounded-2xl shrink-0 ${isHistoryMode ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
            {isHistoryMode ? <History size={24} /> : <HardHat size={24} />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none truncate">{project.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <div className="relative z-50">
                <select className={`pl-8 pr-10 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none border-2 outline-none cursor-pointer transition-all ${isHistoryMode ? 'bg-amber-200 border-amber-400 text-amber-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 hover:border-indigo-400'}`} value={viewingMeasurementId} onChange={(e) => setViewingMeasurementId(e.target.value === 'current' ? 'current' : Number(e.target.value))}>
                  <option value="current">Medição Atual ({project.measurementNumber})</option>
                  {project.history?.map(h => <option key={h.measurementNumber} value={h.measurementNumber}>Snap: Medição {h.measurementNumber}</option>)}
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Clock size={12} /></div>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 text-current"><ChevronDown size={14} /></div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest whitespace-nowrap">Ref: {displayData.date}</span>
              {isHistoryMode && <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 rounded-md text-[8px] font-black uppercase shadow-sm"><Lock size={10} /> Somente Leitura</div>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isHistoryMode && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mr-2 border border-slate-200 dark:border-slate-700 shadow-inner">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                title="Desfazer (Undo)"
                className={`p-2.5 rounded-xl transition-all ${canUndo ? 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm hover:scale-110 active:scale-90' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
              >
                <Undo2 size={18} />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                title="Refazer (Redo)"
                className={`p-2.5 rounded-xl transition-all ${canRedo ? 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm hover:scale-110 active:scale-90' : 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed'}`}
              >
                <Redo2 size={18} />
              </button>
            </div>
          )}

          {!isHistoryMode ? (
            <div className="flex items-center gap-2">
              {project.history && project.history.length > 0 && (
                <button onClick={handleReopenMeasurement} className="flex items-center gap-2 px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
                  <RotateCcw size={16} /> Reabrir Medição
                </button>
              )}
              <button onClick={() => { if (window.confirm("CONFIRMAÇÃO CRÍTICA: Deseja encerrar o período atual? Isso irá gerar um snapshot histórico e limpar as quantidades medidas para o próximo período.")) { onCloseMeasurement(); } }} className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-500/20">
                <CheckCircle2 size={16} /> Encerrar Período
              </button>
            </div>
          ) : (
            <button onClick={() => setViewingMeasurementId('current')} className="flex items-center gap-2 px-6 py-3.5 bg-white border-2 border-amber-400 text-amber-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 active:scale-95 transition-all shadow-sm">
              <ArrowRight size={16} /> Voltar ao Período Aberto
            </button>
          )}
        </div>
      </header>

      {/* 2. SUB-NAVEGAÇÃO */}
      <nav className="no-print bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-20 overflow-hidden">
        <div ref={tabsNavRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} className={`px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none transition-shadow ${isDraggingState ? 'shadow-inner' : ''}`}>
          <TabBtn active={tab === 'wbs'} id="wbs" label="Planilha EAP" icon={<Layers size={16} />} />
          <TabBtn active={tab === 'stats'} id="stats" label="Análise Técnica" icon={<BarChart3 size={16} />} />
          <TabBtn active={tab === 'expenses'} id="expenses" label="Fluxo Financeiro" icon={<Coins size={16} />} />
          <TabBtn active={tab === 'planning'} id="planning" label="Canteiro Ágil" icon={<HardHat size={16} />} />
          <TabBtn active={tab === 'journal'} id="journal" label="Diário de Obra" icon={<BookOpen size={16} />} />
          <TabBtn active={tab === 'documents'} id="documents" label="Repositório" icon={<FileText size={16} />} />
          <TabBtn active={tab === 'workforce'} id="workforce" label="Mão de Obra" icon={<Users size={16} />} />
          <TabBtn active={tab === 'branding'} id="branding" label="Configurações" icon={<Sliders size={16} />} />
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent pointer-events-none" />
      </nav>

      {/* 3. CONTEÚDO DINÂMICO */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {tab === 'wbs' && <WbsView project={{ ...project, items: displayData.items }} onUpdateProject={onUpdateProject} onOpenModal={handleOpenModal} isReadOnly={displayData.isReadOnly} />}
          {tab === 'stats' && <StatsView project={{ ...project, items: displayData.items }} />}
          {tab === 'expenses' && <ExpenseManager project={project} expenses={project.expenses} onAdd={(ex) => onUpdateProject({ expenses: [...project.expenses, ex] })} onAddMany={(exs) => onUpdateProject({ expenses: [...project.expenses, ...exs] })} onUpdate={(id, data) => onUpdateProject({ expenses: project.expenses.map(e => e.id === id ? { ...e, ...data } : e) })} onDelete={(id) => onUpdateProject({ expenses: project.expenses.filter(e => e.id !== id) })} workItems={displayData.items} measuredValue={treeService.calculateBasicStats(displayData.items, project.bdi).current} onUpdateExpenses={(exs) => onUpdateProject({ expenses: exs })} isReadOnly={displayData.isReadOnly} />}
          {tab === 'workforce' && <WorkforceManager project={project} onUpdateProject={onUpdateProject} />}
          {tab === 'planning' && <PlanningView project={project} onUpdatePlanning={(p) => onUpdateProject({ planning: p })} onAddExpense={(ex) => onUpdateProject({ expenses: [...project.expenses, ex] })} categories={displayData.items.filter(i => i.type === 'category')} allWorkItems={displayData.items} />}
          {tab === 'journal' && <JournalView project={project} onUpdateJournal={(j) => onUpdateProject({ journal: j })} allWorkItems={displayData.items} />}
          {tab === 'documents' && <AssetManager assets={project.assets} onAdd={(a) => onUpdateProject({ assets: [...project.assets, a] })} onDelete={(id) => onUpdateProject({ assets: project.assets.filter(as => as.id !== id) })} isReadOnly={displayData.isReadOnly} />}
          {tab === 'branding' && <BrandingView project={project} onUpdateProject={onUpdateProject} isReadOnly={displayData.isReadOnly} />}
        </div>
      </div>

      <WorkItemModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveWorkItem} editingItem={editingItem} type={modalType} categories={treeService.flattenTree(treeService.buildTree(displayData.items.filter(i => i.type === 'category')), new Set(displayData.items.map(i => i.id)))} projectBdi={project.bdi} />
    </div>
  );
};
