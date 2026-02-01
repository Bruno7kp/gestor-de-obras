
import React, { useState, useMemo } from 'react';
import { Project, WorkItem, ItemType, ProjectPlanning, ProjectExpense, ProjectJournal, GlobalSettings } from '../types';
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
  Printer, Undo2, Redo2, Lock, Calendar, BookOpen
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
  const [tab, setTab] = useState<'wbs' | 'planning' | 'journal' | 'stats' | 'expenses' | 'documents' | 'branding'>('wbs');
  
  // Controle de Modal local (Encapsulado)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ItemType>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const printData = useMemo(() => {
    const tree = treeService.buildTree(project.items);
    const processed = tree.map((root, idx) => treeService.processRecursive(root, '', idx, project.bdi));
    const allIds = new Set(project.items.map(i => i.id));
    const flattened = treeService.flattenTree(processed, allIds);
    const stats = treeService.calculateBasicStats(project.items, project.bdi);
    return { flattened, stats };
  }, [project.items, project.bdi]);

  const processedCategories = useMemo(() => {
    return printData.flattened.filter(item => item.type === 'category');
  }, [printData.flattened]);

  const handleOpenModal = (type: ItemType, item: WorkItem | null, parentId: string | null) => {
    setModalType(type);
    setEditingItem(item);
    setTargetParentId(parentId);
    setIsModalOpen(true);
  };

  /**
   * handleUpdateItemsWithCleanup
   * Centraliza a atualização de itens EAP e garante que o Planejamento seja saneado
   * caso ocorra uma exclusão de categoria.
   */
  const handleUpdateItemsWithCleanup = (newItems: WorkItem[]) => {
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
        <header className="min-h-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between px-6 md:px-10 py-4 md:py-0 shrink-0 z-40 gap-4">
          <div className="flex flex-col gap-1 overflow-hidden text-left">
            <div className="hidden md:flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500 truncate">{project.name}</span>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner whitespace-nowrap">
                <TabBtn active={tab === 'wbs'} onClick={() => setTab('wbs')} label="Planilha" icon={<Layers size={14}/>} />
                <TabBtn active={tab === 'planning'} onClick={() => setTab('planning')} label="Planejamento" icon={<Calendar size={14}/>} />
                <TabBtn active={tab === 'journal'} onClick={() => setTab('journal')} label="Diário" icon={<BookOpen size={14}/>} />
                <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} label="Análise" icon={<BarChart3 size={14}/>} />
                <TabBtn active={tab === 'expenses'} onClick={() => setTab('expenses')} label="Financeiro" icon={<Coins size={14}/>} />
                <TabBtn active={tab === 'documents'} onClick={() => setTab('documents')} label="Docs" icon={<FileText size={14}/>} />
                <TabBtn active={tab === 'branding'} onClick={() => setTab('branding')} label="Ajustes Obra" icon={<Sliders size={14}/>} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button disabled={!canUndo} onClick={onUndo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Undo2 size={16}/></button>
              <button disabled={!canRedo} onClick={onRedo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"><Redo2 size={16}/></button>
            </div>
            <button onClick={() => window.print()} title="Gerar PDF" className="p-3 text-white bg-slate-900 dark:bg-slate-700 hover:scale-105 active:scale-95 rounded-2xl transition-all shadow-lg"><Printer size={18}/></button>
            <button 
              onClick={onCloseMeasurement} 
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Lock size={14}/> <span>Fechar Medição</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-10 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-[1600px] mx-auto">
            {tab === 'wbs' && (
              <WbsView 
                project={project} 
                onUpdateProject={data => {
                  if (data.items) handleUpdateItemsWithCleanup(data.items);
                  else onUpdateProject(data);
                }} 
                onOpenModal={handleOpenModal} 
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
        data={printData.flattened} 
        expenses={project.expenses} 
        stats={printData.stats as any} 
      />

      {isModalOpen && (
        <WorkItemModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSave={(data) => {
            if (editingItem) {
              handleUpdateItemsWithCleanup(project.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it));
            } else {
              const newItem: WorkItem = {
                id: crypto.randomUUID(), parentId: targetParentId, name: data.name || 'Novo Registro', 
                type: data.type || modalType, wbs: '', order: project.items.filter(i => i.parentId === targetParentId).length,
                unit: data.unit || 'un', contractQuantity: data.contractQuantity || 0, unitPrice: 0, 
                unitPriceNoBdi: data.unitPriceNoBdi || 0, contractTotal: 0,
                previousQuantity: 0, previousTotal: 0, currentQuantity: 0, currentTotal: 0, currentPercentage: 0,
                accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0, balanceQuantity: 0, balanceTotal: 0
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
