# ProMeasure Pro - Schema Prisma: Decisões de Arquitetura

## 📋 Índice
1. [Visão Geral](#visão-geral)
2. [Decisões de Modelagem](#decisões-de-modelagem)
3. [Implementação de Limites por Tier](#implementação-de-limites-por-tier)
4. [Performance e Indexação](#performance-e-indexação)
5. [Migração do LocalStorage](#migração-do-localstorage)

---

## 🎯 Visão Geral

O schema foi projetado para transformar o ProMeasure Pro de uma aplicação single-user em uma plataforma SaaS multi-tenant com controle granular de acesso e auditoria completa.

### Princípios Arquiteturais
- **Multi-tenancy Rígido**: Todos os dados pertencem a uma `Organization`
- **Soft Deletes**: Campos `deletedAt` para recuperação de dados
- **Audit Trail Completo**: Rastreamento imutável de todas as ações
- **Precision Financeira**: `Decimal(18,2)` para evitar erros de ponto flutuante
- **Hierarchical Flattening**: WorkItems em representação flat com reconstrução em memória

---

## 🏗️ Decisões de Modelagem

### 1. **Hierarquia de Tenancy**

```
Organization (Construtora XYZ)
  ├── Users (Engenheiros, Gerentes)
  ├── Projects (Obras)
  │     ├── WorkItems (EAP/WBS)
  │     ├── Expenses (Despesas)
  │     └── ProjectMembers (Acesso granular)
  └── GlobalSettings (CNPJ, Certificados)
```

**Por que não usar um tenant_id em cada tabela?**
- Relacionamento em cascata: `Organization -> Project -> WorkItem` garante isolamento automático
- Menor redundância de dados
- Queries mais simples (JOIN ao invés de WHERE em cada tabela)

### 2. **WorkItem: Flattened vs Nested**

**Decisão**: Armazenamento flat com `parentId` + reconstrução virtual em memória.

**Por quê?**
- ✅ **Performance de escrita**: INSERT simples, sem necessidade de atualizar toda a árvore
- ✅ **Queries eficientes**: `WHERE projectId = ?` retorna tudo de uma vez
- ✅ **Compatibilidade com o código atual**: Seu `treeService.ts` já faz essa reconstrução

**Alternativa descartada**: PostgreSQL Ltree (adiciona complexidade desnecessária)

**Campos essenciais**:
```prisma
model WorkItem {
  wbs      String   // "1.2.3" (calculado no app)
  order    Int      // Ordem de exibição no nível
  parentId String?  // Auto-relacionamento
}
```

### 3. **Tipos Decimais para Valores Financeiros**

**Todos os campos monetários usam `@db.Decimal(18, 2)`**:
- `18` dígitos totais (suporta valores até R$ 9.999.999.999.999.999,99)
- `2` casas decimais (centavos)

**Por quê não usar Float/Double?**
```javascript
// ❌ PROBLEMA com Float:
0.1 + 0.2 = 0.30000000000000004

// ✅ SOLUÇÃO com Decimal:
0.1 + 0.2 = 0.30 (exato)
```

**Campos com 4 decimais** (quantidades):
```prisma
contractQuantity Decimal @db.Decimal(18, 4) // Ex: 1234.5678 m³
```

### 4. **Access Control: ProjectMember**

**Problema resolvido**: Como dar acesso granular a obras específicas?

**Solução**: Tabela de junção com `accessLevel`:
```prisma
model ProjectMember {
  userId      String
  projectId   String
  accessLevel AccessLevel // READ, WRITE, ADMIN
}
```

**Exemplo de uso**:
```typescript
// Gerente atribui engenheiro à obra
await prisma.projectMember.create({
  data: {
    userId: "eng_123",
    projectId: "obra_456",
    accessLevel: "WRITE"
  }
});

// Query: Quais obras o usuário pode ver?
const projects = await prisma.project.findMany({
  where: {
    members: {
      some: {
        userId: currentUser.id
      }
    }
  }
});
```

### 5. **MeasurementSnapshot: Time Machine**

**Problema**: Como auditar medições anteriores se os WorkItems são mutáveis?

**Solução**: Congelar estado completo em JSON:
```prisma
model MeasurementSnapshot {
  measurementNumber Int
  itemsSnapshot     Json // Array completo de WorkItems congelado
  contractTotal     Decimal
  accumulatedTotal  Decimal
}
```

**Trade-off**:
- ❌ Desnormalização (dados duplicados)
- ✅ Performance em queries históricas (não precisa reconstruir estado)
- ✅ Imutabilidade (snapshot nunca muda)

### 6. **AuditLog: Rastreamento Imutável**

**Campos JSONB para flexibilidade**:
```prisma
model AuditLog {
  action     String // "UPDATE_WORK_ITEM"
  entityType String // "WORK_ITEM"
  entityId   String // "item_123"
  oldValue   Json?  // { quantity: 10.5 }
  newValue   Json?  // { quantity: 12.0 }
}
```

**Por que JSONB e não colunas tipadas?**
- Diferentes entidades têm diferentes campos
- Flexibilidade para adicionar novos campos sem migração
- PostgreSQL tem índices GIN para queries em JSONB

---

## 💰 Implementação de Limites por Tier

### Estratégia: Validação na Camada de Aplicação

**Não use constraints de banco de dados** (rígido demais).
**Use validação em middleware Prisma** (flexível e auditável).

### Implementação Recomendada

```typescript
// src/lib/tier-limits.ts

interface TierLimits {
  projects: number;
  users: number;
  storage: number; // bytes
}

const TIER_LIMITS: Record<PlanTier, TierLimits> = {
  FREE: {
    projects: 3,
    users: 2,
    storage: 100 * 1024 * 1024, // 100MB
  },
  PRO: {
    projects: 50,
    users: 10,
    storage: 10 * 1024 * 1024 * 1024, // 10GB
  },
  ENTERPRISE: {
    projects: -1, // Unlimited
    users: -1,
    storage: -1,
  },
};

export async function checkProjectLimit(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { _count: { select: { projects: true } } },
  });

  const limit = TIER_LIMITS[org.planTier].projects;
  
  if (limit !== -1 && org._count.projects >= limit) {
    throw new Error(
      `Limite de ${limit} projetos atingido. Faça upgrade para PRO.`
    );
  }
}

// Uso em API Routes
export async function POST(req: Request) {
  const { organizationId, name } = await req.json();
  
  // ✅ Validação ANTES de criar
  await checkProjectLimit(organizationId);
  
  const project = await prisma.project.create({
    data: { organizationId, name, /* ... */ }
  });
  
  return Response.json(project);
}
```

### Middleware Prisma (Alternativa)

```typescript
// prisma/middleware.ts
prisma.$use(async (params, next) => {
  if (params.model === 'Project' && params.action === 'create') {
    const orgId = params.args.data.organizationId;
    await checkProjectLimit(orgId);
  }
  return next(params);
});
```

### Alertas Visuais (UX)

```typescript
// components/ProjectList.tsx
function ProjectLimitBanner({ org }) {
  const usage = org._count.projects;
  const limit = TIER_LIMITS[org.planTier].projects;
  const percentage = (usage / limit) * 100;
  
  if (percentage >= 80) {
    return (
      <Alert variant="warning">
        Você está usando {usage}/{limit} projetos ({percentage}%).
        <UpgradeButton />
      </Alert>
    );
  }
}
```

---

## ⚡ Performance e Indexação

### Índices Críticos

```prisma
@@index([projectId])        // Queries por obra
@@index([organizationId])   // Isolamento multi-tenant
@@index([parentId])         // Reconstrução de árvores
@@index([wbs])              // Busca por numeração WBS
```

### Composite Indexes (futuro)

Para queries complexas frequentes:
```prisma
@@index([projectId, type])  // Filtrar itens por tipo em uma obra
@@index([userId, projectId]) // Verificar acesso de usuário
```

### Contadores Desnormalizados

**Quando usar**:
```prisma
model Project {
  totalWorkItems Int @default(0) // Cache
  lastMeasurementValue Decimal @default(0)
}
```

**Atualização via Trigger** (PostgreSQL):
```sql
CREATE OR REPLACE FUNCTION update_project_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Project" 
  SET "totalWorkItems" = (
    SELECT COUNT(*) FROM "WorkItem" WHERE "projectId" = NEW."projectId"
  )
  WHERE id = NEW."projectId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔄 Migração do LocalStorage

### Estratégia de Importação

```typescript
// tools/migrate-from-localstorage.ts

interface LocalStorageProject {
  id: string;
  name: string;
  items: WorkItem[];
  expenses: ProjectExpense[];
  // ... resto dos campos
}

async function importProject(
  localProject: LocalStorageProject,
  organizationId: string,
  userId: string
) {
  // 1. Criar projeto
  const project = await prisma.project.create({
    data: {
      id: localProject.id, // Manter IDs originais
      name: localProject.name,
      organizationId,
      creatorId: userId,
      // ... outros campos
    },
  });

  // 2. Importar WorkItems (batch insert)
  await prisma.workItem.createMany({
    data: localProject.items.map(item => ({
      ...item,
      projectId: project.id,
    })),
  });

  // 3. Importar Expenses
  await prisma.projectExpense.createMany({
    data: localProject.expenses.map(exp => ({
      ...exp,
      projectId: project.id,
    })),
  });

  // 4. Criar snapshot inicial
  await prisma.measurementSnapshot.create({
    data: {
      projectId: project.id,
      measurementNumber: 0,
      itemsSnapshot: localProject.items,
      // ... totals
    },
  });
}

// Uso
const localData = JSON.parse(localStorage.getItem('projects'));
for (const project of localData) {
  await importProject(project, 'org_123', 'user_456');
}
```

### Script de Migração em Massa

```bash
# Exportar dados do localStorage para JSON
node scripts/export-localstorage.js > data.json

# Importar para PostgreSQL
npx tsx scripts/import-to-postgres.ts data.json
```

---

## 🔐 Segurança e Compliance

### Row-Level Security (RLS) - PostgreSQL

```sql
-- Garantir que usuários só vejam dados da própria organização
CREATE POLICY org_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_org_id'));

-- Ativar RLS
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
```

### Soft Deletes

```typescript
// Middleware global para soft deletes
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  
  if (params.action === 'findMany') {
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    };
  }
  
  return next(params);
});
```

---

## 📊 Queries Otimizadas de Exemplo

### 1. Dashboard de Organização

```typescript
const dashboard = await prisma.organization.findUnique({
  where: { id: orgId },
  include: {
    _count: {
      select: {
        projects: true,
        users: true,
      },
    },
    projects: {
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        contractTotal: true,
        measurementNumber: true,
      },
      take: 10,
    },
  },
});
```

### 2. Árvore de WorkItems com Totais

```typescript
const items = await prisma.workItem.findMany({
  where: { projectId },
  orderBy: { order: 'asc' },
});

// Reconstruir árvore em memória (como você já faz)
const tree = buildTree(items);
const totals = calculateRollups(tree);
```

### 3. Histórico de Auditoria

```typescript
const history = await prisma.auditLog.findMany({
  where: {
    entityType: 'WORK_ITEM',
    entityId: itemId,
  },
  include: { user: { select: { name: true } } },
  orderBy: { timestamp: 'desc' },
});
```

---

## 🚀 Próximos Passos

1. **Gerar cliente Prisma**:
   ```bash
   npx prisma generate
   ```

2. **Criar primeira migração**:
   ```bash
   npx prisma migrate dev --name init
   ```

3. **Seed de dados de teste**:
   ```bash
   npx prisma db seed
   ```

4. **Implementar API Routes** (Next.js App Router):
   - `/api/projects` - CRUD de projetos
   - `/api/work-items` - Gestão de EAP
   - `/api/measurements` - Medições

5. **Middleware de autenticação**:
   - Validar JWT
   - Extrair `organizationId`
   - Aplicar RLS

---

## 📚 Referências

- [Prisma Multi-tenancy Guide](https://www.prisma.io/docs/guides/database/multi-tenancy)
- [Decimal Types in PostgreSQL](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [Audit Trail Patterns](https://martinfowler.com/eaaDev/AuditLog.html)

---

**Desenvolvido com rigor técnico para escalar de 1 a 10.000 organizações.**
