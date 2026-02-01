import React, { useState, useEffect } from 'react';
import { useProjectState } from './hooks/useProjectState';
import { projectService } from './services/projectService';
import { biddingService } from './services/biddingService';

import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { BiddingView } from './components/BiddingView';

import { Menu } from 'lucide-react';

type ViewMode = 'global-dashboard' | 'project-workspace' | 'system-settings' | 'bidding-view';

const App: React.FC = () => {
  const { 
    projects, biddings, groups, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, updateGroups, updateBiddings, updateCertificates, bulkUpdate
  } = useProjectState();

  // Garantir que globalSettings sempre existe com valores padrão
  const safeGlobalSettings = globalSettings || {
    defaultCompanyName: 'Sua Empresa de Engenharia',
    userName: 'Usuário ProMeasure',
    language: 'pt-BR' as const,
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

  const handleOpenProject = (id: string) => {
    setActiveProjectId(id);
    setViewMode('project-workspace');
    setMobileMenuOpen(false);
  };

  const handleCreateProjectFromBidding = (bidding: any) => {
    const newProj = biddingService.convertToProject(bidding, safeGlobalSettings.defaultCompanyName);
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  };

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      <Sidebar 
        isOpen={sidebarOpen} setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen}
        viewMode={viewMode} setViewMode={setViewMode}
        projects={projects} groups={groups} activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject} onCreateProject={(gid) => {
          const np = projectService.createProject('Nova Obra', safeGlobalSettings.defaultCompanyName, gid || null);
          updateProjects([...projects, np]);
          handleOpenProject(np.id);
        }}
        isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        certificates={safeGlobalSettings.certificates}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="no-print lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300"><Menu size={24} /></button>
          <span className="ml-4 text-xs font-black uppercase tracking-widest truncate">
            {viewMode === 'global-dashboard' ? 'Dashboard' : (viewMode === 'bidding-view' ? 'Licitações' : activeProject?.name)}
          </span>
        </header>

        {viewMode === 'global-dashboard' && (
          <DashboardView projects={projects} groups={groups} onOpenProject={handleOpenProject} onCreateProject={(gid) => {
            const np = projectService.createProject('Nova Obra', safeGlobalSettings.defaultCompanyName, gid || null);
            updateProjects([...projects, np]);
            handleOpenProject(np.id);
          }} onUpdateProjects={updateProjects} onUpdateGroups={updateGroups} onBulkUpdate={bulkUpdate} />
        )}

        {viewMode === 'bidding-view' && (
          <BiddingView 
            biddings={biddings} 
            certificates={safeGlobalSettings.certificates} 
            onUpdateBiddings={updateBiddings} 
            onUpdateCertificates={updateCertificates}
            onCreateProjectFromBidding={handleCreateProjectFromBidding}
          />
        )}

        {viewMode === 'system-settings' && (
          <SettingsView settings={safeGlobalSettings} onUpdate={setGlobalSettings} projectCount={projects.length} />
        )}

        {viewMode === 'project-workspace' && activeProject && (
          <ProjectWorkspace 
            project={activeProject}
            onUpdateProject={updateActiveProject}
            onCloseMeasurement={() => {}} // Simplificado
            canUndo={false} canRedo={false} onUndo={() => {}} onRedo={() => {}}
          />
        )}
      </main>
    </div>
  );
};

export default App;