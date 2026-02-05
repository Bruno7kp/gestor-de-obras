
import React, { useState, useEffect, useCallback } from 'react';
import { useProjectState } from './hooks/useProjectState';
import { projectService } from './services/projectService';
import { biddingService } from './services/biddingService';

import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { BiddingView } from './components/BiddingView';
import { SupplierManager } from './components/SupplierManager';

import { Menu } from 'lucide-react';

type ViewMode = 'global-dashboard' | 'project-workspace' | 'system-settings' | 'bidding-view' | 'supplier-view';

const App: React.FC = () => {
  const { 
    projects, biddings, groups, suppliers, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, updateGroups, updateSuppliers, updateBiddings, updateCertificates, bulkUpdate,
    undo, redo, canUndo, canRedo
  } = useProjectState();

  const safeGlobalSettings = globalSettings || {
    defaultCompanyName: 'Sua Empresa de Engenharia',
    companyCnpj: '',
    userName: 'Usuário ProMeasure',
    language: 'pt-BR',
    currencySymbol: 'R$',
    certificates: []
  };

  const [viewMode, setViewMode] = useState<ViewMode>('global-dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('promeasure_theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('promeasure_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleOpenProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setViewMode('project-workspace');
    setMobileMenuOpen(false);
  }, [setActiveProjectId]);

  const handleCloseMeasurement = useCallback(() => {
    if (!activeProject) return;
    const updated = projectService.closeMeasurement(activeProject);
    updateActiveProject(updated);
  }, [activeProject, updateActiveProject]);

  const handleCreateProject = useCallback((groupId?: string | null) => {
    const newProj = projectService.createProject('Nova Obra', safeGlobalSettings.defaultCompanyName, groupId || null);
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  const handleCreateProjectFromBidding = useCallback((bidding: any) => {
    const newProj = biddingService.convertToProject(bidding, safeGlobalSettings.defaultCompanyName);
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      
      <Sidebar 
        isOpen={sidebarOpen} setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen}
        viewMode={viewMode} setViewMode={setViewMode}
        projects={projects} groups={groups} activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject} onCreateProject={handleCreateProject}
        isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        certificates={safeGlobalSettings.certificates}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="no-print lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300"><Menu size={24} /></button>
          <span className="ml-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 truncate">
            {viewMode === 'global-dashboard' ? 'Portal de Obras' : viewMode === 'bidding-view' ? 'Setor de Licitações' : viewMode === 'supplier-view' ? 'Base de Fornecedores' : viewMode === 'system-settings' ? 'Configurações de Sistema' : 'Obra em Gestão'}
          </span>
        </header>

        {viewMode === 'global-dashboard' && (
          <DashboardView projects={projects} groups={groups} onOpenProject={handleOpenProject} onCreateProject={handleCreateProject} onUpdateProject={updateProjects} onUpdateGroups={updateGroups} onBulkUpdate={bulkUpdate} />
        )}

        {viewMode === 'bidding-view' && (
          <BiddingView biddings={biddings} certificates={safeGlobalSettings.certificates} onUpdateBiddings={updateBiddings} onUpdateCertificates={updateCertificates} onCreateProjectFromBidding={handleCreateProjectFromBidding} />
        )}

        {viewMode === 'supplier-view' && <SupplierManager suppliers={suppliers} onUpdateSuppliers={updateSuppliers} />}

        {viewMode === 'system-settings' && <SettingsView settings={safeGlobalSettings as any} onUpdate={setGlobalSettings} projectCount={projects.length} />}

        {viewMode === 'project-workspace' && activeProject && (
          <ProjectWorkspace 
            project={activeProject}
            globalSettings={safeGlobalSettings as any}
            suppliers={suppliers}
            onUpdateProject={updateActiveProject}
            onCloseMeasurement={handleCloseMeasurement}
            canUndo={canUndo} 
            canRedo={canRedo} 
            onUndo={undo} 
            onRedo={redo}
          />
        )}
      </main>
    </div>
  );
};

export default App;
