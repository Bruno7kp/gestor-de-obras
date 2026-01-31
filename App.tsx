
import React, { useState, useMemo, useRef } from 'react';
// Fixed: Imported DEFAULT_THEME explicitly to avoid using require()
import { ItemType, Project, WorkItem, DEFAULT_THEME } from './types';
import { treeService } from './services/treeService';
import { excelService, ImportResult } from './services/excelService';
import { financial } from './utils/math';
import { useProjectState } from './hooks/useProjectState';

// Componentes Modulares
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { WorkItemModal } from './components/WorkItemModal';

import { Menu } from 'lucide-react';

type ViewMode = 'global-dashboard' | 'project-workspace' | 'system-settings';

const App: React.FC = () => {
  const { 
    projects, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, finalizeMeasurement,
    undo, redo, canUndo, canRedo
  } = useProjectState();

  // Estados de UI
  const [viewMode, setViewMode] = useState<ViewMode>('global-dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Estados de Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ItemType>('item');
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setViewMode('project-workspace');
    setMobileMenuOpen(false);
  };

  const handleCreateProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: 'Novo Empreendimento',
      companyName: globalSettings.defaultCompanyName,
      measurementNumber: 1,
      referenceDate: new Date().toLocaleDateString('pt-BR'),
      logo: null,
      items: [],
      history: [],
      // Fixed: Replaced require('./types').DEFAULT_THEME with the imported constant
      theme: { ...DEFAULT_THEME },
      bdi: 25,
      assets: [],
      expenses: [],
      config: { strict: false, printCards: true, printSubtotals: true }
    };
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar 
        isOpen={sidebarOpen} setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen}
        viewMode={viewMode} setViewMode={setViewMode}
        projects={projects} activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject} onCreateProject={handleCreateProject}
        isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300"><Menu size={24} /></button>
          <span className="ml-4 text-xs font-black uppercase tracking-widest truncate">
            {viewMode === 'global-dashboard' ? 'Dashboard' : (viewMode === 'system-settings' ? 'Configurações' : activeProject?.name)}
          </span>
        </header>

        {viewMode === 'global-dashboard' && (
          <DashboardView 
            projects={projects} 
            onOpenProject={handleOpenProject} 
            onCreateProject={handleCreateProject} 
            onUpdateProjects={updateProjects}
          />
        )}

        {viewMode === 'system-settings' && (
          <SettingsView 
            settings={globalSettings} 
            onUpdate={setGlobalSettings} 
            projectCount={projects.length} 
          />
        )}

        {viewMode === 'project-workspace' && activeProject && (
          <ProjectWorkspace 
            project={activeProject}
            onUpdateProject={updateActiveProject}
            onCloseMeasurement={finalizeMeasurement}
            canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo}
            onOpenModal={(type, item, parentId) => {
              setModalType(type);
              setEditingItem(item);
              setTargetParentId(parentId);
              setIsModalOpen(true);
            }}
          />
        )}
      </main>

      {activeProject && isModalOpen && (
        <WorkItemModal 
          isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} 
          onSave={(data) => {
            if (editingItem) {
              updateActiveProject({ items: activeProject.items.map(it => it.id === editingItem.id ? { ...it, ...data } : it) });
            } else {
              const newItem: WorkItem = {
                id: crypto.randomUUID(), parentId: targetParentId, name: data.name || 'Novo Registro', 
                type: data.type || modalType, wbs: '', order: activeProject.items.filter(i => i.parentId === targetParentId).length,
                unit: data.unit || 'un', contractQuantity: data.contractQuantity || 0, unitPrice: 0, 
                unitPriceNoBdi: data.unitPriceNoBdi || 0, contractTotal: 0,
                previousQuantity: 0, previousTotal: 0, currentQuantity: 0, currentTotal: 0, currentPercentage: 0,
                accumulatedQuantity: 0, accumulatedTotal: 0, accumulatedPercentage: 0, balanceQuantity: 0, balanceTotal: 0
              };
              updateActiveProject({ items: [...activeProject.items, newItem] });
            }
          }} 
          editingItem={editingItem} type={modalType} 
          categories={activeProject.items.filter(i => i.type === 'category')} 
          projectBdi={activeProject.bdi} 
        />
      )}
    </div>
  );
};

export default App;
