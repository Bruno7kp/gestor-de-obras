# Modelo de Dados (LocalStorage → Futuro Banco)

Este documento descreve as entidades atuais do app (localStorage) e adiciona a camada multi-instância solicitada para planejamento de migração.

## Diagrama (Mermaid ER)

```mermaid
erDiagram
  SUPER_ADMIN {
    string id
    string name
    string email
  }

  INSTANCE {
    string id
    string name
    string status
    string createdAt
  }

  USER {
    string id
    string name
    string email
    string status
    string createdAt
  }

  ROLE {
    string id
    string name
    string description
  }

  PERMISSION {
    string id
    string code
    string description
  }

  USER_ROLE {
    string id
    string userId
    string roleId
  }

  ROLE_PERMISSION {
    string id
    string roleId
    string permissionId
  }

  SUBSCRIPTION {
    string id
    string plan
    string status
    string startDate
    string endDate
    string billingCycle
  }

  GLOBAL_SETTINGS {
    string defaultCompanyName
    string companyCnpj
    string userName
    string language
    string currencySymbol
  }

  COMPANY_CERTIFICATE {
    string id
    string name
    string issuer
    string expirationDate
    string fileData
    string status
  }

  PROJECT_GROUP {
    string id
    string parentId
    string name
    number order
  }

  PROJECT {
    string id
    string groupId
    string name
    string companyName
    string companyCnpj
    string location
    number measurementNumber
    string referenceDate
    string logo
    number bdi
    number contractTotalOverride
    number currentTotalOverride
    boolean strict
    boolean printCards
    boolean printSubtotals
    boolean showSignatures
  }

  PDF_THEME {
    string fontFamily
    string primary
    string accent
    string accentText
    string border
    string currencySymbol
  }

  PDF_BOX_THEME {
    string bg
    string text
  }

  WORK_ITEM {
    string id
    string parentId
    string name
    string type
    string wbs
    number order
    string unit
    string cod
    string fonte
    number contractQuantity
    number unitPrice
    number unitPriceNoBdi
    number contractTotal
    number previousQuantity
    number previousTotal
    number currentQuantity
    number currentTotal
    number currentPercentage
    number accumulatedQuantity
    number accumulatedTotal
    number accumulatedPercentage
    number balanceQuantity
    number balanceTotal
  }

  MEASUREMENT_SNAPSHOT {
    number measurementNumber
    string date
    number contract
    number period
    number accumulated
    number progress
  }

  PROJECT_ASSET {
    string id
    string name
    string fileType
    number fileSize
    string uploadDate
    string data
  }

  PROJECT_EXPENSE {
    string id
    string parentId
    string type
    string itemType
    string wbs
    number order
    string date
    string paymentDate
    string description
    string entityName
    string unit
    number quantity
    number unitPrice
    number discountValue
    number discountPercentage
    number amount
    boolean isPaid
    string linkedWorkItemId
  }

  PROJECT_PLANNING {
    string id
  }

  PLANNING_TASK {
    string id
    string categoryId
    string description
    boolean isCompleted
    string status
    string dueDate
    string createdAt
    string completedAt
  }

  MATERIAL_FORECAST {
    string id
    string description
    number quantityNeeded
    number unitPrice
    string unit
    string estimatedDate
    string status
    boolean isPaid
    number order
  }

  MILESTONE {
    string id
    string title
    string date
    boolean isCompleted
  }

  PROJECT_JOURNAL {
    string id
  }

  JOURNAL_ENTRY {
    string id
    string timestamp
    string type
    string category
    string title
    string description
    string weatherStatus
  }

  BIDDING_PROCESS {
    string id
    string tenderNumber
    string clientName
    string object
    string openingDate
    string visitDate
    string expirationDate
    number estimatedValue
    number ourProposalValue
    string status
    number bdi
  }

  SUPPLIER {
    string id
    string name
    string cnpj
    string contactName
    string email
    string phone
    string category
    number rating
    string notes
    number order
  }

  SUPER_ADMIN ||--o{ INSTANCE : manages
  INSTANCE ||--|| SUBSCRIPTION : has
  INSTANCE ||--|| GLOBAL_SETTINGS : has
  GLOBAL_SETTINGS ||--o{ COMPANY_CERTIFICATE : certificates

  INSTANCE ||--o{ USER : users
  INSTANCE ||--o{ ROLE : roles
  ROLE ||--o{ USER_ROLE : grants
  USER ||--o{ USER_ROLE : assigned
  ROLE ||--o{ ROLE_PERMISSION : permissions
  PERMISSION ||--o{ ROLE_PERMISSION : included

  INSTANCE ||--o{ PROJECT : owns
  INSTANCE ||--o{ PROJECT_GROUP : organizes
  INSTANCE ||--o{ SUPPLIER : manages
  INSTANCE ||--o{ BIDDING_PROCESS : manages

  PROJECT_GROUP ||--o{ PROJECT_GROUP : children
  PROJECT_GROUP ||--o{ PROJECT : contains

  PROJECT ||--o{ WORK_ITEM : items
  WORK_ITEM ||--o{ WORK_ITEM : children

  PROJECT ||--o{ MEASUREMENT_SNAPSHOT : history
  PROJECT ||--o{ PROJECT_ASSET : assets
  PROJECT ||--o{ PROJECT_EXPENSE : expenses
  PROJECT_EXPENSE ||--o{ PROJECT_EXPENSE : children
  PROJECT_EXPENSE }o--|| WORK_ITEM : linkedWorkItemId

  PROJECT ||--|| PROJECT_PLANNING : planning
  PROJECT_PLANNING ||--o{ PLANNING_TASK : tasks
  PROJECT_PLANNING ||--o{ MATERIAL_FORECAST : forecasts
  PROJECT_PLANNING ||--o{ MILESTONE : milestones

  PROJECT ||--|| PROJECT_JOURNAL : journal
  PROJECT_JOURNAL ||--o{ JOURNAL_ENTRY : entries

  PROJECT ||--|| PDF_THEME : theme
  PDF_THEME ||--|| PDF_BOX_THEME : header
  PDF_THEME ||--|| PDF_BOX_THEME : category
  PDF_THEME ||--|| PDF_BOX_THEME : footer
  PDF_THEME ||--|| PDF_BOX_THEME : kpiHighlight

  BIDDING_PROCESS ||--o{ WORK_ITEM : items
  BIDDING_PROCESS ||--o{ PROJECT_ASSET : assets
```

## Notas
- Entidades e campos derivam de [types.ts](types.ts).
- A camada multi-instância (SUPER_ADMIN → INSTANCE → SUBSCRIPTION) foi adicionada para suportar várias instâncias do sistema com assinatura.
- RBAC por instância: USER ⇄ ROLE ⇄ PERMISSION via tabelas de ligação.
- Em uma futura migração para banco, INSTANCE funcionará como tenant e será a raiz para todas as entidades do app.
