
import React, { useState, useMemo, useRef } from 'react';
import { Project, GlobalSettings, WorkItem, MeasurementSnapshot } from '../types';
import { 
  Layers, BarChart3, Coins, Users, HardHat, BookOpen, FileText, Sliders, 
  ChevronLeft, CheckCircle2, Printer, History, Calendar, Lock, ChevronDown,
  ArrowRight
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
  project, globalSettings, onUpdateProject, onCloseMeasurement
}) => {
  const [tab, setTab] = useState<'wbs' | 'stats' | 'expenses' | 'workforce' | 'planning' | 'journal' | 'documents' | 'branding'>('wbs');
  const [viewingMeasurementId, setViewingMeasurementId] = useState<'current' | number>('current');

  // Refs para lógica de Drag-to-Scroll
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // WorkItem Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'category' | 'item'>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  /**
   * Lógica de Arraste Lateral com o Mouse
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsNavRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - tabsNavRef.current.offsetLeft);
    setScrollLeft(tabsNavRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsNavRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsNavRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Multiplicador de velocidade
    tabsNavRef.current.scrollLeft = scrollLeft - walk;
  };

  const displayData = useMemo(() => {
    if (viewingMeasurementId === 'current') {
      return {
        items: project.items,
        isReadOnly: false,
        label: `Medição Nº ${project.measurementNumber} (Em Aberto)`,
        date: project.referenceDate
      };
    }
    const snapshot = project.history.find(h => h.measurementNumber === viewingMeasurementId);
    if (snapshot) {
      return {
        items: snapshot.items,
        isReadOnly: true,
        label: `Medição Nº ${snapshot.measurementNumber} (Encerrada)`,
        date: snapshot.date
      };
    }
    return { items: project.items, isReadOnly: false, label: 'Erro', date: '' };
  }, [project, viewingMeasurementId]);

  const isHistoryMode = viewingMeasurementId !== 'current';

  const handleTabClick = (e: React.MouseEvent, newTab: typeof tab) => {
    // Se estiver arrastando, ignorar o clique para não mudar de aba sem querer
    if (isDragging) return;
    e.preventDefault();
    setTab(newTab);
  };

  const handleOpenModal = (type: 'category' | 'item', item: WorkItem | null, parentId: string | null) => {
    if (displayData.isReadOnly) return;
    setModalType(type);
    setEditingItem(item);
    setTargetParentId(parentId);
    setIsModalOpen(true);
  };

  const handleSaveWorkItem = (data: Partial<WorkItem>) => {
    if (editingItem) {
      onUpdateProject({
        items: project.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it)
      });
    } else {
      const newItem: WorkItem = {
        id: crypto.randomUUID(),
        parentId: targetParentId,
        name: data.name || '',
        type: modalType,
        wbs: '',
        order: project.items.length,
        unit: data.unit || 'un',
        cod: data.cod,
        fonte: data.fonte,
        contractQuantity: data.contractQuantity || 0,
        unitPrice: data.unitPrice || 0,
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
      };
      onUpdateProject({ items: [...project.items, newItem] });
    }
  };

  const TabBtn: React.FC<{ active: boolean; onClick: (e: any) => void; label: string; icon: React.ReactNode }> = ({ active, onClick, label, icon }) => (
    <button
      onMouseDown={(e) => e.stopPropagation()} // Permite o evento no pai para scroll
      onClick={onClick}
      className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shrink-0 select-none ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
          : 'bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* 1. HEADER DE CONTEXTO */}
      <header className={`no-print border-b p-6 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 z-30 transition-colors ${
        isHistoryMode ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${isHistoryMode ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600'}`}>
            {isHistoryMode ? <History size={24} /> : <HardHat size={24} />}
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">
              {project.name}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="relative group">
                <select 
                  className={`pl-8 pr-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest appearance-none border-2 outline-none cursor-pointer transition-all ${
                    isHistoryMode 
                      ? 'bg-amber-100 border-amber-300 text-amber-700' 
                      : 'bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500 group-hover:border-indigo-500'
                  }`}
                  value={viewingMeasurementId}
                  onChange={(e) => setViewingMeasurementId(e.target.value === 'current' ? 'current' : Number(e.target.value))}
                >
                  <option value="current">Medição Atual (Aberta)</option>
                  {project.history.map(h => (
                    <option key={h.measurementNumber} value={h.measurementNumber}>
                      Snap Medição Nº {h.measurementNumber}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <Calendar size={12} />
                </div>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <ChevronDown size={12} />
                </div>
              </div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Ref: {displayData.date}</span>
              {isHistoryMode && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-100 rounded-md text-[8px] font-black uppercase">
                  <Lock size={10} /> Somente Leitura
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isHistoryMode && (
            <button 
              onClick={() => {
                if (window.confirm("CONFIRMAÇÃO CRÍTICA: Deseja encerrar o período atual? O estado físico-financeiro será arquivado e um novo período de medição será iniciado.")) {
                  onCloseMeasurement();
                }
              }}
              className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
            >
              <CheckCircle2 size={16}/> Encerrar Período
            </button>
          )}
          {isHistoryMode && (
            <button onClick={() => setViewingMeasurementId('current')} className="flex items-center gap-2 px-6 py-3.5 bg-white border-2 border-amber-300 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-50 active:scale-95 transition-all">
              <ArrowRight size={16}/> Voltar para Atual
            </button>
          )}
        </div>
      </header>

      {/* 2. SUB-NAVEGAÇÃO COM DRAG-TO-SCROLL ATIVADO */}
      <nav 
        className="no-print bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 z-20 overflow-hidden"
      >
        <div 
          ref={tabsNavRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={`px-6 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing select-none transition-shadow ${isDragging ? 'shadow-inner' : ''}`}
        >
          <TabBtn active={tab === 'wbs'} onClick={(e: any) => handleTabClick(e, 'wbs')} label="Planilha EAP" icon={<Layers size={16}/>} />
          <TabBtn active={tab === 'stats'} onClick={(e: any) => handleTabClick(e, 'stats')} label="Análise Técnica" icon={<BarChart3 size={16}/>} />
          <TabBtn active={tab === 'expenses'} onClick={(e: any) => handleTabClick(e, 'expenses')} label="Fluxo Financeiro" icon={<Coins size={16}/>} />
          <TabBtn active={tab === 'workforce'} onClick={(e: any) => handleTabClick(e, 'workforce')} label="Mão de Obra" icon={<Users size={16}/>} />
          <TabBtn active={tab === 'planning'} onClick={(e: any) => handleTabClick(e, 'planning')} label="Canteiro Ágil" icon={<HardHat size={16}/>} />
          <TabBtn active={tab === 'journal'} onClick={(e: any) => handleTabClick(e, 'journal')} label="Diário de Obra" icon={<BookOpen size={16}/>} />
          <TabBtn active={tab === 'documents'} onClick={(e: any) => handleTabClick(e, 'documents')} label="Repositório" icon={<FileText size={16}/>} />
          <TabBtn active={tab === 'branding'} onClick={(e: any) => handleTabClick(e, 'branding')} label="Configurações" icon={<Sliders size={16}/>} />
        </div>
        {/* Gradiente sutil para indicar mais itens */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent pointer-events-none" />
      </nav>

      {/* 3. CONTEÚDO */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          {tab === 'wbs' && (
            <WbsView 
              project={{...project, items: displayData.items}} 
              onUpdateProject={onUpdateProject} 
              onOpenModal={handleOpenModal}
              isReadOnly={displayData.isReadOnly}
            />
          )}
          {tab === 'stats' && <StatsView project={{...project, items: displayData.items}} />}
          {tab === 'expenses' && (
            <ExpenseManager 
              project={project}
              expenses={project.expenses}
              onAdd={(ex) => onUpdateProject({ expenses: [...project.expenses, ex] })}
              onAddMany={(exs) => onUpdateProject({ expenses: [...project.expenses, ...exs] })}
              onUpdate={(id, data) => onUpdateProject({ expenses: project.expenses.map(e => e.id === id ? { ...e, ...data } : e) })}
              onDelete={(id) => onUpdateProject({ expenses: project.expenses.filter(e => e.id !== id) })}
              workItems={displayData.items}
              measuredValue={treeService.calculateBasicStats(displayData.items, project.bdi).current}
              onUpdateExpenses={(exs) => onUpdateProject({ expenses: exs })}
              isReadOnly={displayData.isReadOnly}
            />
          )}
          {tab === 'workforce' && <WorkforceManager project={project} onUpdateProject={onUpdateProject} />}
          {tab === 'planning' && (
            <PlanningView 
              project={project}
              onUpdatePlanning={(p) => onUpdateProject({ planning: p })}
              onAddExpense={(ex) => onUpdateProject({ expenses: [...project.expenses, ex] })}
              categories={displayData.items.filter(i => i.type === 'category')}
              allWorkItems={displayData.items}
            />
          )}
          {tab === 'journal' && <JournalView project={project} onUpdateJournal={(j) => onUpdateProject({ journal: j })} allWorkItems={displayData.items} />}
          {tab === 'documents' && <AssetManager assets={project.assets} onAdd={(a) => onUpdateProject({ assets: [...project.assets, a] })} onDelete={(id) => onUpdateProject({ assets: project.assets.filter(as => as.id !== id) })} isReadOnly={displayData.isReadOnly} />}
          {tab === 'branding' && <BrandingView project={project} onUpdateProject={onUpdateProject} isReadOnly={displayData.isReadOnly} />}
        </div>
      </div>

      <WorkItemModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveWorkItem}
        editingItem={editingItem}
        type={modalType}
        categories={treeService.flattenTree(treeService.buildTree(displayData.items.filter(i => i.type === 'category')), new Set(displayData.items.map(i => i.id)))}
        projectBdi={project.bdi}
      />
    </div>
  );
};
