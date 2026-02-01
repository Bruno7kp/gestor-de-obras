
import React, { useState, useEffect, useCallback } from 'react';
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
  // Hook de estado centralizado
  const { 
    projects, biddings, groups, activeProject, activeProjectId, setActiveProjectId, 
    globalSettings, setGlobalSettings,
    updateActiveProject, updateProjects, updateGroups, updateBiddings, updateCertificates, bulkUpdate
  } = useProjectState();

  // Configurações com fallback seguro
  const safeGlobalSettings = globalSettings || {
    defaultCompanyName: 'Sua Empresa de Engenharia',
    userName: 'Usuário ProMeasure',
    language: 'pt-BR',
    certificates: []
  };

  // Estados de interface
  const [viewMode, setViewMode] = useState<ViewMode>('global-dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('promeasure_theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sincronização de tema (Light/Dark Mode)
  useEffect(() => {
    localStorage.setItem('promeasure_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Navegação: Abrir Obra
  const handleOpenProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setViewMode('project-workspace');
    setMobileMenuOpen(false);
  }, [setActiveProjectId]);

  // Navegação: Criar Obra do zero ou vinculada a uma pasta
  const handleCreateProject = useCallback((groupId?: string | null) => {
    const newProj = projectService.createProject(
      'Nova Obra', 
      safeGlobalSettings.defaultCompanyName, 
      groupId || null
    );
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  // Ação especial: Converter Licitação Ganha em Obra
  const handleCreateProjectFromBidding = useCallback((bidding: any) => {
    const newProj = biddingService.convertToProject(bidding, safeGlobalSettings.defaultCompanyName);
    updateProjects([...projects, newProj]);
    handleOpenProject(newProj.id);
  }, [projects, safeGlobalSettings.defaultCompanyName, updateProjects, handleOpenProject]);

  return (
    <div className={`flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 ${isDarkMode ? 'dark' : ''}`}>
      
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        mobileOpen={mobileMenuOpen} 
        setMobileOpen={setMobileMenuOpen}
        viewMode={viewMode} 
        setViewMode={setViewMode}
        projects={projects} 
        groups={groups} 
        activeProjectId={activeProjectId}
        onOpenProject={handleOpenProject} 
        onCreateProject={handleCreateProject}
        isDarkMode={isDarkMode} 
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        certificates={safeGlobalSettings.certificates}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* HEADER MOBILE */}
        <header className="no-print lg:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 shrink-0 z-50">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-300">
            <Menu size={24} />
          </button>
          <span className="ml-4 text-xs font-black uppercase tracking-widest truncate">
            {viewMode === 'global-dashboard' ? 'Dashboard' : 
             viewMode === 'bidding-view' ? 'Licitações' : 
             viewMode === 'system-settings' ? 'Configurações' : 
             activeProject?.name}
          </span>
        </header>

        {/* VIEW: CENTRAL DE OBRAS (DASHBOARD) */}
        {viewMode === 'global-dashboard' && (
          <DashboardView 
            projects={projects} 
            groups={groups} 
            onOpenProject={handleOpenProject} 
            onCreateProject={handleCreateProject}
            onUpdateProject={updateProjects} 
            onUpdateGroups={updateGroups} 
            onBulkUpdate={bulkUpdate} 
          />
        )}

        {/* VIEW: LICITAÇÕES (BIDDING) */}
        {viewMode === 'bidding-view' && (
          <BiddingView 
            biddings={biddings} 
            certificates={safeGlobalSettings.certificates} 
            onUpdateBiddings={updateBiddings} 
            onUpdateCertificates={updateCertificates}
            onCreateProjectFromBidding={handleCreateProjectFromBidding}
          />
        )}

        {/* VIEW: CONFIGURAÇÕES DO SISTEMA */}
        {viewMode === 'system-settings' && (
          <SettingsView 
            settings={safeGlobalSettings} 
            onUpdate={setGlobalSettings} 
            projectCount={projects.length} 
          />
        )}

        {/* VIEW: WORKSPACE DA OBRA SELECIONADA */}
        {viewMode === 'project-workspace' && activeProject && (
          <ProjectWorkspace 
            project={activeProject}
            globalSettings={safeGlobalSettings}
            onUpdateProject={updateActiveProject}
            onCloseMeasurement={() => {}} // Reservado para versão futura de status de medição
            canUndo={false} 
            canRedo={false} 
            onUndo={() => {}} 
            onRedo={() => {}}
          />
        )}
      </main>
    </div>
  );
};

export default App;
