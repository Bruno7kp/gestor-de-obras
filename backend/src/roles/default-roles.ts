export type PermissionLevel = 'none' | 'view' | 'edit';

export const PERMISSION_MODULES = [
  { key: 'biddings', label: 'Licitacoes' },
  { key: 'suppliers', label: 'Fornecedores' },
  { key: 'projects_general', label: 'Obras gerais' },
  { key: 'projects_specific', label: 'Obras especificas' },
  { key: 'wbs', label: 'Planilha EAP' },
  { key: 'technical_analysis', label: 'Analise Tecnica' },
  { key: 'financial_flow', label: 'Fluxo Financeiro' },
  { key: 'supplies', label: 'Suprimentos' },
  { key: 'workforce', label: 'Mao de Obra' },
  { key: 'planning', label: 'Planejamento' },
  { key: 'journal', label: 'Diario de Obra' },
  { key: 'documents', label: 'Documentos' },
  { key: 'project_settings', label: 'Ajustes do projeto' },
  { key: 'global_settings', label: 'Configuracoes gerais' },
];

export interface DefaultRoleDefinition {
  name: string;
  description?: string;
  access: Record<string, PermissionLevel>;
}

export const DEFAULT_ROLES: DefaultRoleDefinition[] = [
  {
    name: 'Gestor Principal',
    description: 'Permissão total na instância',
    access: PERMISSION_MODULES.reduce(
      (acc, module) => {
        acc[module.key] = 'edit';
        return acc;
      },
      {} as Record<string, PermissionLevel>,
    ),
  },
  {
    name: 'Gestor de Suprimentos',
    description: 'Operação focada em suprimentos e fornecedores',
    access: {
      biddings: 'none',
      suppliers: 'edit',
      projects_general: 'none',
      projects_specific: 'view',
      wbs: 'none',
      technical_analysis: 'none',
      financial_flow: 'none',
      supplies: 'edit',
      workforce: 'edit',
      planning: 'none',
      journal: 'none',
      documents: 'none',
      project_settings: 'none',
      global_settings: 'none',
    },
  },
  {
    name: 'Arquiteto',
    description: 'Acesso de acompanhamento técnico e diário',
    access: {
      biddings: 'none',
      suppliers: 'view',
      projects_general: 'none',
      projects_specific: 'edit',
      wbs: 'none',
      technical_analysis: 'none',
      financial_flow: 'none',
      supplies: 'none',
      workforce: 'none',
      planning: 'edit',
      journal: 'edit',
      documents: 'edit',
      project_settings: 'none',
      global_settings: 'none',
    },
  },
];

export const buildPermissionCodes = (
  access: Record<string, PermissionLevel>,
) => {
  const codes: string[] = [];

  PERMISSION_MODULES.forEach((module) => {
    const level = access[module.key] ?? 'none';
    if (level === 'view' || level === 'edit') {
      codes.push(`${module.key}.view`);
    }
    if (level === 'edit') {
      codes.push(`${module.key}.edit`);
    }
  });

  return codes;
};
