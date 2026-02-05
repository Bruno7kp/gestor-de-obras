# Lista Final de Entidades e Escopo

Fonte: [types.ts](types.ts) e [infos/data-model-mermaid.md](infos/data-model-mermaid.md)

## Globais (fora de instancia)
- SUPER_ADMIN
- INSTANCE
- SUBSCRIPTION

## Por instancia (tenant)
- USER
- ROLE
- PERMISSION
- USER_ROLE
- ROLE_PERMISSION
- GLOBAL_SETTINGS
- COMPANY_CERTIFICATE
- PROJECT_GROUP
- PROJECT
- WORK_ITEM
- MEASUREMENT_SNAPSHOT
- PROJECT_ASSET
- PROJECT_EXPENSE
- PROJECT_PLANNING
- PLANNING_TASK
- MATERIAL_FORECAST
- MILESTONE
- PROJECT_JOURNAL
- JOURNAL_ENTRY
- BIDDING_PROCESS
- SUPPLIER
- WORKFORCE_MEMBER
- STAFF_DOCUMENT
- PDF_THEME
- PDF_BOX_THEME

## Observacoes
- Todas as entidades por instancia devem carregar `instanceId` (tenant).
- Em nivel de projeto, `projectId` organiza o dominio core.
- WorkItem e ProjectExpense sao hierarquicos (parentId).
- WorkforceMember possui relacao many-to-many com WorkItem (responsabilidades).
