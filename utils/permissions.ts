/**
 * Permission system constants and utilities
 * 
 * Modules: biddings, suppliers, projects_general, projects_specific, wbs, technical_analysis, financial_flow,
 *          supplies, workforce, planning, journal, documents, project_settings, global_settings
 * 
 * Levels: view (read-only), edit (read+write), none (no access)
 */

export type PermissionLevel = 'none' | 'view' | 'edit';
export type PermissionModule = 
  | 'biddings' | 'suppliers' | 'projects_general' | 'projects_specific' 
  | 'wbs' | 'technical_analysis' | 'financial_flow' | 'supplies' | 'workforce' 
  | 'planning' | 'schedule' | 'journal' | 'documents' | 'project_settings' | 'global_settings';

export const PERMISSION_MODULES: Array<{ key: PermissionModule; label: string }> = [
  { key: 'biddings', label: 'Licitações' },
  { key: 'suppliers', label: 'Fornecedores' },
  { key: 'projects_general', label: 'Obras gerais' },
  { key: 'projects_specific', label: 'Obras especificas' },
  { key: 'wbs', label: 'Planilha EAP' },
  { key: 'technical_analysis', label: 'Análise Técnica' },
  { key: 'financial_flow', label: 'Fluxo Financeiro' },
  { key: 'supplies', label: 'Suprimentos' },
  { key: 'workforce', label: 'Mão de Obra' },
  { key: 'planning', label: 'Planejamento' },
  { key: 'schedule', label: 'Cronograma' },
  { key: 'journal', label: 'Diário de Obra' },
  { key: 'documents', label: 'Documentos' },
  { key: 'project_settings', label: 'Ajustes do projeto' },
  { key: 'global_settings', label: 'Configurações gerais' },
];

/**
 * Permission codes: {module}.{level}
 * Example: 'biddings.edit', 'projects_general.view', 'planning.edit'
 */
export const PERMISSIONS = {
  // Biddings
  BIDDINGS_VIEW: 'biddings.view',
  BIDDINGS_EDIT: 'biddings.edit',
  
  // Suppliers
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_EDIT: 'suppliers.edit',
  
  // Projects - General (all projects in instance)
  PROJECTS_GENERAL_VIEW: 'projects_general.view',
  PROJECTS_GENERAL_EDIT: 'projects_general.edit',
  
  // Projects - Specific (assigned projects only)
  PROJECTS_SPECIFIC_VIEW: 'projects_specific.view',
  PROJECTS_SPECIFIC_EDIT: 'projects_specific.edit',
  
  // WBS
  WBS_VIEW: 'wbs.view',
  WBS_EDIT: 'wbs.edit',
  
  // Technical Analysis
  TECHNICAL_ANALYSIS_VIEW: 'technical_analysis.view',
  TECHNICAL_ANALYSIS_EDIT: 'technical_analysis.edit',
  
  // Financial Flow
  FINANCIAL_FLOW_VIEW: 'financial_flow.view',
  FINANCIAL_FLOW_EDIT: 'financial_flow.edit',
  
  // Supplies
  SUPPLIES_VIEW: 'supplies.view',
  SUPPLIES_EDIT: 'supplies.edit',
  
  // Workforce
  WORKFORCE_VIEW: 'workforce.view',
  WORKFORCE_EDIT: 'workforce.edit',
  
  // Planning
  PLANNING_VIEW: 'planning.view',
  PLANNING_EDIT: 'planning.edit',

  // Schedule
  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_EDIT: 'schedule.edit',
  
  // Journal
  JOURNAL_VIEW: 'journal.view',
  JOURNAL_EDIT: 'journal.edit',
  
  // Documents
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_EDIT: 'documents.edit',
  
  // Project Settings
  PROJECT_SETTINGS_VIEW: 'project_settings.view',
  PROJECT_SETTINGS_EDIT: 'project_settings.edit',
  
  // Global Settings
  GLOBAL_SETTINGS_VIEW: 'global_settings.view',
  GLOBAL_SETTINGS_EDIT: 'global_settings.edit',
} as const;

/**
 * Utility functions for permission checking
 */

/**
 * Check if user has a specific permission code
 * @param permissions Array of permission codes the user has
 * @param code Permission code to check (e.g., 'biddings.edit')
 * @returns true if user has the permission
 */
export function hasPermission(
  permissions: string[] | undefined,
  code: string,
): boolean {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(code);
}

/**
 * Check if user can edit a module
 * @param permissions Array of permission codes
 * @param module Module name
 * @returns true if user has {module}.edit permission
 */
export function canEdit(
  permissions: string[] | undefined,
  module: PermissionModule,
): boolean {
  return hasPermission(permissions, `${module}.edit`);
}

/**
 * Check if user can view a module (view or edit implies view)
 * @param permissions Array of permission codes
 * @param module Module name
 * @returns true if user has {module}.view or {module}.edit permission
 */
export function canView(
  permissions: string[] | undefined,
  module: PermissionModule,
): boolean {
  return (
    hasPermission(permissions, `${module}.view`) ||
    hasPermission(permissions, `${module}.edit`)
  );
}

/**
 * Get permission level for a module
 * @param permissions Array of permission codes
 * @param module Module name
 * @returns 'edit', 'view', or 'none'
 */
export function getPermissionLevel(
  permissions: string[] | undefined,
  module: PermissionModule,
): PermissionLevel {
  if (hasPermission(permissions, `${module}.edit`)) return 'edit';
  if (hasPermission(permissions, `${module}.view`)) return 'view';
  return 'none';
}

/**
 * Build permission set from permission codes
 * Useful for quick lookups
 */
export function buildPermissionSet(
  permissions: string[] | undefined,
): Set<string> {
  return new Set(permissions ?? []);
}

/**
 * Filter modules user can view (has any access to)
 */
export function getAccessibleModules(
  permissions: string[] | undefined,
): PermissionModule[] {
  const moduleKeys = PERMISSION_MODULES.map((m) => m.key);
  return moduleKeys.filter((module) => canView(permissions, module));
}

/**
 * Filter modules user can edit
 */
export function getEditableModules(
  permissions: string[] | undefined,
): PermissionModule[] {
  const moduleKeys = PERMISSION_MODULES.map((m) => m.key);
  return moduleKeys.filter((module) => canEdit(permissions, module));
}
