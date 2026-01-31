
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkItem, DEFAULT_THEME, ItemType, Project, PDFTheme } from './types';
import { treeService } from './services/treeService';
import { excelService, ImportResult } from './services/excelService';
import { TreeTable } from './components/TreeTable';
import { ThemeEditor } from './components/ThemeEditor';
import { WorkItemModal } from './components/WorkItemModal';
import { EvolutionChart } from './components/EvolutionChart';
import { PrintReport } from './components/PrintReport';
import { financial } from './utils/math';
import { useProjectState } from './hooks/useProjectState';
import { 
  Plus, 
  TrendingUp,
  Database,
  Moon,
  Sun,
  HardHat,
  Search,
  Briefcase,
  PieChart,
  Layers,
  FileSpreadsheet,
  UploadCloud,
  Menu,
  CheckCircle2,
  Printer,
  Trash2,
  Edit2,
  Percent,
  Download,
  Lock,
  Undo2,
  Redo2,
  ChevronRight,
  Settings,
  PlusCircle,
  BarChart3,
  Home,
  Clock,
  AlertTriangle
} from 'lucide-react';

type ViewMode = 'global-dashboard' | 'project-workspace' | 'system-settings';

const App: React.FC = () => {
  const { 
    projects, 
    activeProject, 
    activeProjectId, 
    setActiveProjectId, 
    updateActiveProject, 
    updateProjects,
    finalizeMeasurement,
    undo,
    redo,
    canUndo,
    canRedo
  } = useProjectState();

  const [viewMode, setViewMode] = useState<ViewMode>('global-dashboard');
  const [projectTab, setProjectTab] = useState<'wbs' | 'branding' | 'stats'>('wbs');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ItemType>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState({ isOpen: false, id: '', name: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: '' });
  const [closeMeasurementModal, setCloseMeasurementModal] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentItems = useMemo(() => {
    if (!activeProject) return [];
    if (selectedSnapshot === null) return activeProject.items;
    const snap = activeProject.history?.find(h => h.measurementNumber === selectedSnapshot);
    return snap ? snap.items : [];
  }, [activeProject, selectedSnapshot]);

  const isReadOnly = selectedSnapshot !== null;

  const processedTree = useMemo(() => {
    if (!activeProject) return [];
    const tree = treeService.buildTree(currentItems);
    return tree.map((root, idx) => treeService.processRecursive(root, '', idx, activeProject.bdi));
  }, [activeProject, currentItems]);

  const flattenedList = useMemo(() => 
    treeService.flattenTree(processedTree, expandedIds)
  , [processedTree, expandedIds]);

  const stats = useMemo(() => {
    const totals = {
      contract: financial.sum(processedTree.map(n => n.contractTotal || 0)),
      current: financial.sum(processedTree.map(n => n.currentTotal || 0)),
      accumulated: financial.sum(processedTree.map(n => n.accumulatedTotal || 0)),
      balance: financial.sum(processedTree.map(n => n.balanceTotal || 0)),
    };
    return { ...totals, progress: totals.contract > 0 ? (totals.accumulated / totals.contract) * 100 : 0 };
  }, [processedTree]);

  useEffect(() => {
    setSelectedSnapshot(null);
  }, [activeProjectId]);

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setViewMode('project-workspace');
    setProjectTab('wbs');
    setSelectedSnapshot(null);
  };

  const handleCreateProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: 'Novo Empreendimento',
      companyName: 'Sua Empresa de Engenharia',
      measurementNumber: 1,
      referenceDate: new Date().toLocaleDateString('pt-BR'),
      logo: null,
      items: [],
      history: [],
      theme: { ...DEFAULT_THEME },
      bdi: 25,
      config: { strict: false, printCards: true, printSubtotals: true }
    };
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  };

  const handleReorder = (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    if (!activeProject) return;
    const newItems = treeService.reorderItems(activeProject.items, sourceId, targetId, position);
    updateActiveProject({ items: newItems });
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("[UI] Arquivo selecionado:", file.name);
      setIsImporting(true);
      try {
        const result = await excelService.parseAndValidate(file);
        if (result.items.length === 0) {
          alert("Nenhum item válido foi encontrado na planilha. Verifique se os nomes das colunas estão corretos.");
        } else {
          setImportSummary(result);
        }
      } catch (error: any) {
        console.error("[UI] Erro na importação:", error);
        alert(`Erro ao importar: ${error.message || "Erro desconhecido"}`);
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const canFinalize = useMemo(() => {
    if (!activeProject || isReadOnly) return false;
    return stats.current > 0 || activeProject.items.some(it => (it.currentQuantity || 0) > 0);
  }, [stats.current, activeProject, isReadOnly]);

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileImport} />

      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-50 no-print`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
            <HardHat size={18} />
          </div>
          {sidebarOpen && <span className="ml-3 text-sm font-black tracking-tight uppercase">ProMeasure</span>}
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem active={viewMode === 'global-dashboard'} onClick={() => setViewMode('global-dashboard')} icon={<Home size={18}/>} label="Dashboard" open={sidebarOpen} />
          <NavItem active={viewMode === 'system-settings'} onClick={() => setViewMode('system-settings')} icon={<Settings size={18}/>} label="Configurações Globais" open={sidebarOpen} />
          
          <div className="pt-6 pb-2 px-3">
             {sidebarOpen ? (
               <div className="flex items-center justify-between">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meus Projetos</h3>
                 <button onClick={handleCreateProject} className="text-indigo-500 hover:text-indigo-600"><PlusCircle size={14}/></button>
               </div>
             ) : <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2" />}
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[50vh] custom-scrollbar">
            {projects.map(p => (
              <button key={p.id} onClick={() => handleOpenProject(p.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeProjectId === p.id && viewMode === 'project-workspace' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <Briefcase size={16} className="shrink-0" />
                {sidebarOpen && <span className="text-[11px] truncate">{p.name}</span>}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center gap-3 p-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
            {sidebarOpen && <span className="text-[11px] font-bold uppercase tracking-widest">{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center gap-3 p-3 text-slate-400 hover:text-slate-600 rounded-xl">
             <Menu size={18} />
             {sidebarOpen && <span className="text-[11px] font-bold uppercase tracking-widest">Recolher Menu</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-hidden relative no-print">
        {viewMode === 'global-dashboard' && (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar animate-in fade-in duration-500">
             <div className="max-w-6xl mx-auto space-y-12">
                <header className="flex items-center justify-between">
                   <div>
                      <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">Central de Empreendimentos</h1>
                      <p className="text-slate-500 font-medium">Você possui {projects.length} obras cadastradas.</p>
                   </div>
                   <button onClick={handleCreateProject} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all">
                      <Plus size={16} /> Novo Empreendimento
                   </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                   {projects.map(p => {
                      const projStats = treeService.calculateBasicStats(p.items, p.bdi);
                      return (
                        <div key={p.id} onClick={() => handleOpenProject(p.id)} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] p-8 shadow-sm hover:shadow-2xl hover:border-indigo-500 transition-all cursor-pointer relative overflow-hidden">
                           <div className="relative z-10 flex justify-between items-start mb-6">
                              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-2xl"><Briefcase size={20}/></div>
                              <div className="flex gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setRenameModal({isOpen: true, id: p.id, name: p.name}); }} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit2 size={16}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setDeleteModal({isOpen: true, id: p.id}); }} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                              </div>
                           </div>
                           <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 truncate group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Medição Atual: #{p.measurementNumber}</p>
                           <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso Total</span>
                                 <span className="text-sm font-black text-indigo-600">{projStats.progress.toFixed(1)}%</span>
                              </div>
                              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${projStats.progress}%` }} />
                              </div>
                           </div>
                        </div>
                      )
                   })}
                </div>
             </div>
          </div>
        )}

        {viewMode === 'project-workspace' && activeProject && (
          <div className="flex-1 flex flex-col overflow-hidden">
             <header className="h-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-10 shrink-0 z-40">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <Home size={12} className="cursor-pointer hover:text-indigo-500" onClick={() => setViewMode('global-dashboard')} />
                      <ChevronRight size={10} />
                      <span className="text-slate-500">{activeProject.name}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
                         <TabBtn active={projectTab === 'wbs'} onClick={() => setProjectTab('wbs')} label="Planilha EAP" icon={<Layers size={14}/>} />
                         <TabBtn active={projectTab === 'stats'} onClick={() => setProjectTab('stats')} label="Análise de Evolução" icon={<BarChart3 size={14}/>} />
                         <TabBtn active={projectTab === 'branding'} onClick={() => setProjectTab('branding')} label="Configurações do Projeto" icon={<Settings size={14}/>} />
                      </div>
                      <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                      <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-2xl border border-indigo-100/50">
                         <Clock size={14} className="text-indigo-500" />
                         <select className="bg-transparent text-[10px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300 outline-none cursor-pointer" value={selectedSnapshot === null ? 'current' : selectedSnapshot} onChange={(e) => { const val = e.target.value; setSelectedSnapshot(val === 'current' ? null : parseInt(val)); }}>
                            <option value="current">Medição Atual (#{activeProject.measurementNumber})</option>
                            {(activeProject.history || []).map(h => ( <option key={h.measurementNumber} value={h.measurementNumber}>Histórico: #{h.measurementNumber} ({h.date})</option> ))}
                         </select>
                      </div>
                   </div>
                </div>

                <div className="flex items-center gap-4">
                   {!isReadOnly && (
                     <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-4">
                        <button disabled={!canUndo} onClick={undo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all shadow-sm"><Undo2 size={16}/></button>
                        <button disabled={!canRedo} onClick={redo} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all shadow-sm"><Redo2 size={16}/></button>
                     </div>
                   )}
                   <button onClick={() => window.print()} className="p-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"><Printer size={18}/></button>
                   {!isReadOnly && (
                     <button onClick={() => setCloseMeasurementModal(true)} disabled={!canFinalize} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${canFinalize ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                        <Lock size={14}/> Fechar Medição
                     </button>
                   )}
                </div>
             </header>

             <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-slate-50 dark:bg-slate-950">
                <div className="max-w-[1600px] mx-auto space-y-8">
                   {projectTab === 'wbs' && (
                     <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                           <div className="flex flex-wrap items-center gap-3">
                              <button disabled={isReadOnly} onClick={() => { setTargetParentId(null); setModalType('item'); setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 disabled:opacity-30 text-white font-black uppercase tracking-widest text-[9px] rounded-xl shadow-lg shadow-indigo-500/10"><Plus size={14}/> Novo Item</button>
                              <button disabled={isReadOnly} onClick={() => { setTargetParentId(null); setModalType('category'); setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 disabled:opacity-30 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-widest text-[9px] rounded-xl"><Layers size={14}/> Novo Grupo</button>
                              <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 mx-2" />
                              <button onClick={() => excelService.downloadTemplate()} className="flex items-center gap-2 px-4 py-3 text-slate-500 hover:text-indigo-600 transition-colors"><FileSpreadsheet size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">Template</span></button>
                              <button disabled={isReadOnly || isImporting} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-3 text-slate-500 hover:text-emerald-600 transition-colors">
                                {isImporting ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={16}/>}
                                <span className="text-[9px] font-black uppercase tracking-widest">{isImporting ? 'Processando...' : 'Importar Planilha'}</span>
                              </button>
                              <button onClick={() => excelService.exportProjectToExcel(activeProject, flattenedList)} className="flex items-center gap-2 px-4 py-3 text-slate-500 hover:text-blue-600 transition-colors"><Download size={16}/> <span className="text-[9px] font-black uppercase tracking-widest">Exportar</span></button>
                           </div>
                           <div className="relative w-full lg:w-96">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <input placeholder="Buscar por descrição..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-11 pr-4 py-3 rounded-xl text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                           </div>
                        </div>

                        <TreeTable 
                          data={flattenedList} expandedIds={expandedIds} 
                          onToggle={id => { const n = new Set(expandedIds); n.has(id) ? n.delete(id) : n.add(id); setExpandedIds(n); }} 
                          onExpandAll={() => setExpandedIds(new Set(currentItems.filter(i => i.type === 'category').map(i => i.id)))}
                          onCollapseAll={() => setExpandedIds(new Set())}
                          onDelete={id => !isReadOnly && updateActiveProject({ items: activeProject.items.filter(i => i.id !== id && i.parentId !== id) })}
                          onUpdateQuantity={(id, qty) => !isReadOnly && updateActiveProject({ items: activeProject.items.map(it => it.id === id ? { ...it, currentQuantity: qty } : it) })}
                          onUpdatePercentage={(id, pct) => !isReadOnly && updateActiveProject({ items: activeProject.items.map(it => it.id === id ? { ...it, currentQuantity: financial.round((pct/100) * it.contractQuantity), currentPercentage: pct } : it) })}
                          onAddChild={(pid, type) => { if(!isReadOnly) { setTargetParentId(pid); setModalType(type); setEditingItem(null); setIsModalOpen(true); } }}
                          onEdit={item => { if(!isReadOnly) { setEditingItem(item); setModalType(item.type); setIsModalOpen(true); } }}
                          onReorder={handleReorder}
                          searchQuery={searchQuery}
                          isReadOnly={isReadOnly}
                        />
                     </div>
                   )}

                   {projectTab === 'stats' && (
                     <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                           <KpiCard label="Contrato Total" value={financial.formatBRL(stats.contract)} icon={<Briefcase size={20}/>} progress={100} color="indigo" />
                           <KpiCard label="Valor na Medição" value={financial.formatBRL(stats.current)} icon={<TrendingUp size={20}/>} progress={stats.progress} color="blue" highlight />
                           <KpiCard label="Total Acumulado" value={financial.formatBRL(stats.accumulated)} icon={<PieChart size={20}/>} progress={stats.progress} color="emerald" />
                           <KpiCard label="Saldo Obra" value={financial.formatBRL(stats.balance)} icon={<Database size={20}/>} progress={100 - stats.progress} color="rose" />
                        </div>
                        <EvolutionChart history={activeProject.history || []} currentProgress={stats.progress} />
                     </div>
                   )}

                   {projectTab === 'branding' && (
                     <div className="space-y-12 animate-in fade-in duration-500">
                        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl mx-auto">
                           <div className="flex items-center gap-4 mb-10">
                              <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-lg"><Percent size={24} /></div>
                              <div>
                                <h3 className="text-xl font-black tracking-tight text-slate-800 dark:text-white">Taxa de BDI do Empreendimento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Esta porcentagem recalcula automaticamente todos os preços unitários "com BDI".</p>
                              </div>
                           </div>
                           <div className="flex flex-col sm:flex-row items-center gap-10">
                              <div className="flex-1 w-full">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Percentual de BDI (%)</label>
                                 <div className="relative">
                                    <input disabled={isReadOnly} type="number" className="w-full px-8 py-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-4xl font-black focus:border-indigo-500 outline-none pr-20 text-slate-800 dark:text-slate-100 transition-all" value={activeProject.bdi} onChange={(e) => updateActiveProject({ bdi: parseFloat(e.target.value) || 0 })} />
                                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">%</span>
                                 </div>
                              </div>
                              <div className="w-full sm:w-64 p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800 text-center">
                                 <p className="text-[9px] font-black text-indigo-400 uppercase mb-2 tracking-widest">Multiplicador Final</p>
                                 <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{(1 + activeProject.bdi/100).toFixed(4)}x</p>
                              </div>
                           </div>
                        </div>
                        <ThemeEditor theme={activeProject.theme} onChange={(theme: PDFTheme) => !isReadOnly && updateActiveProject({ theme })} />
                     </div>
                   )}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* COMPONENTE DE IMPRESSÃO (Oculto no Browser, Visível no Papel) */}
      {activeProject && (
        <PrintReport 
          project={activeProject} 
          data={flattenedList} 
          stats={stats} 
        />
      )}

      {/* MODAL: SUMÁRIO DE IMPORTAÇÃO */}
      {importSummary && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] p-12 shadow-2xl border border-white/10">
            <div className="flex items-center gap-6 mb-10 text-emerald-500">
              <div className="p-5 bg-emerald-500/10 rounded-[2rem]"><CheckCircle2 size={56} /></div>
              <h3 className="text-2xl font-black uppercase tracking-tight text-slate-800 dark:text-white">Planilha Processada</h3>
            </div>
            
            {importSummary.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-8 rounded-3xl text-center border border-indigo-100 dark:border-indigo-800">
                  <p className="text-[32px] font-black text-indigo-600">{importSummary.stats.categories}</p>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Categorias / Grupos</p>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-8 rounded-3xl text-center border border-emerald-100 dark:border-emerald-800">
                  <p className="text-[32px] font-black text-emerald-600">{importSummary.stats.items}</p>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Serviços / Itens</p>
                </div>
              </div>
            ) : (
              <div className="p-8 mb-12 bg-rose-50 dark:bg-rose-900/20 rounded-3xl border border-rose-100 dark:border-rose-800 text-center">
                <AlertTriangle className="mx-auto text-rose-500 mb-4" size={48} />
                <p className="text-sm font-bold text-rose-700 dark:text-rose-400 uppercase">Nenhum dado encontrado</p>
                <p className="text-xs text-rose-600 mt-2">Certifique-se que a planilha segue o formato do template.</p>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setImportSummary(null)} className="flex-1 py-5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              {importSummary.items.length > 0 && (
                <button onClick={() => { activeProject && updateActiveProject({ items: [...activeProject.items, ...importSummary.items] }); setImportSummary(null); }} className="flex-[2] py-5 bg-emerald-600 text-white rounded-[2rem] text-xs font-black uppercase shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all tracking-widest">Confirmar Importação</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modais de edição e exclusão */}
      {activeProject && isModalOpen && (
        <WorkItemModal 
          isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={(data) => {
            if (editingItem) {
              updateActiveProject({ items: activeProject.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it) });
            } else {
              const parentId = targetParentId || data.parentId || null;
              const newItem: WorkItem = {
                id: crypto.randomUUID(), parentId, name: data.name || 'Novo Registro', type: data.type || modalType, wbs: '', order: activeProject.items.filter(i => i.parentId === parentId).length,
                unit: data.unit || 'un', contractQuantity: data.contractQuantity || 0, unitPrice: 0, unitPriceNoBdi: data.unitPriceNoBdi || 0, contractTotal: 0,
                previousQuantity: 0, previousTotal: 0, currentQuantity: 0, currentTotal: 0, currentPercentage: 0,
                accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0, balanceQuantity: 0, balanceTotal: 0
              };
              updateActiveProject({ items: [...activeProject.items, newItem] });
              if (newItem.parentId) setExpandedIds(new Set([...expandedIds, newItem.parentId]));
            }
          }} 
          editingItem={editingItem} type={modalType} categories={activeProject.items.filter(i => i.type === 'category') || []} 
          projectBdi={activeProject.bdi || 0} 
        />
      )}

      {/* Outros modais secundários omitidos mas necessários para a funcionalidade completa */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 size={24} /></div>
              <h3 className="text-xl font-black mb-4 tracking-tight dark:text-white">Excluir Empreendimento?</h3>
              <p className="text-xs text-slate-500 mb-10 font-medium">Todos os dados desta obra e seu histórico de medições serão permanentemente apagados.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({isOpen: false, id: ''})} className="flex-1 py-4 text-xs font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button onClick={() => { 
                   const remaining = projects.filter(p => p.id !== deleteModal.id);
                   updateProjects(remaining);
                   if (activeProjectId === deleteModal.id) {
                     setActiveProjectId(null);
                     setViewMode('global-dashboard');
                   }
                   setDeleteModal({isOpen: false, id: ''});
                }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-rose-500/20 active:scale-95 transition-all tracking-widest">Sim, Excluir</button>
              </div>
           </div>
        </div>
      )}

      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Edit2 size={18} className="text-indigo-500" />
                <h3 className="text-xl font-black tracking-tight dark:text-white">Nome do Projeto</h3>
              </div>
              <input autoFocus className="w-full px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold mb-8 outline-none focus:border-indigo-500 transition-all text-sm dark:text-white" value={renameModal.name} onChange={e => setRenameModal({...renameModal, name: e.target.value})} onKeyDown={(e) => { if(e.key === 'Enter') { updateProjects(projects.map(p => p.id === renameModal.id ? {...p, name: renameModal.name} : p)); setRenameModal({isOpen: false, id: '', name: ''}); } }} />
              <div className="flex gap-3">
                <button onClick={() => setRenameModal({isOpen: false, id: '', name: ''})} className="flex-1 py-4 text-xs font-black uppercase text-slate-400 tracking-widest">Cancelar</button>
                <button onClick={() => { updateProjects(projects.map(p => p.id === renameModal.id ? {...p, name: renameModal.name} : p)); setRenameModal({isOpen: false, id: '', name: ''}); }} className="flex-1 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all tracking-widest">Salvar</button>
              </div>
           </div>
        </div>
      )}

      {closeMeasurementModal && activeProject && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-12 shadow-2xl border border-white/10 text-center">
              <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><Lock size={42} /></div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4 uppercase tracking-tighter">Finalizar Período?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">A medição <strong>#{activeProject.measurementNumber}</strong> será congelada no histórico.<br/>O valor total faturado no período é <strong>{financial.formatBRL(stats.current)}</strong>.</p>
              <div className="flex gap-4">
                <button onClick={() => setCloseMeasurementModal(false)} className="flex-1 py-5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors tracking-widest">Voltar</button>
                <button onClick={() => { finalizeMeasurement(); setCloseMeasurementModal(false); }} className="flex-[2] py-5 bg-indigo-600 text-white rounded-[2rem] text-xs font-black uppercase shadow-xl shadow-indigo-500/20 active:scale-95 transition-all tracking-widest">Confirmar e Abrir Próxima</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ active, onClick, icon, label, open }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
    <div className="shrink-0">{icon}</div>
    {open && <span className="text-[11px] font-bold uppercase tracking-widest truncate text-left">{label}</span>}
  </button>
);

const TabBtn = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
    {icon} {label}
  </button>
);

const KpiCard = ({ label, value, icon, progress, color, highlight = false }: any) => {
  const colors: any = { indigo: 'text-indigo-600', blue: 'text-blue-600', emerald: 'text-emerald-600', rose: 'text-rose-600' };
  return (
    <div className={`p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-xl transition-all ${highlight ? 'ring-4 ring-indigo-500/10' : ''}`}>
      <div className="flex justify-between items-start mb-8">
        <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400`}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className={`text-3xl font-black tracking-tighter mb-6 ${colors[color]}`}>{value}</p>
      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full bg-current opacity-70" style={{ width: `${Math.min(100, progress)}%`, color: `var(--tw-text-opacity)` }} />
      </div>
    </div>
  );
};

export default App;
