# 🚀 ProMeasure Pro - Guia de Setup e Migração

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- npm ou pnpm

## 🛠️ Setup Inicial

### 1. Instalar Dependências

```bash
npm install prisma @prisma/client bcryptjs
npm install -D @types/bcryptjs tsx
```

### 2. Configurar Banco de Dados

Opção A: **PostgreSQL Local**
```bash
# macOS/Linux
brew install postgresql@14
brew services start postgresql@14

# Criar banco de dados
createdb promeasure_dev
```

Opção B: **PostgreSQL na Nuvem (Recomendado)**
- [Neon](https://neon.tech) - Free tier generoso
- [Supabase](https://supabase.com) - Includes auth, storage
- [Railway](https://railway.app) - Deploy fácil

### 3. Configurar Variáveis de Ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/promeasure_dev"
```

### 4. Gerar Cliente Prisma

```bash
npx prisma generate
```

### 5. Executar Migração

```bash
# Criar migração inicial
npx prisma migrate dev --name init

# Aplicar migração em produção
npx prisma migrate deploy
```

### 6. Popular Banco com Dados de Teste

Adicione ao `package.json`:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Execute:
```bash
npx prisma db seed
```

## 🔄 Migração do LocalStorage

### Estratégia

1. **Exportar dados do localStorage para JSON**
2. **Transformar estrutura para compatibilidade com Prisma**
3. **Importar via script**

### Script de Exportação

Crie `scripts/export-localstorage.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Export LocalStorage</title>
</head>
<body>
  <h1>ProMeasure - Export Data</h1>
  <button onclick="exportData()">Download JSON</button>
  
  <script>
    function exportData() {
      const projects = JSON.parse(localStorage.getItem('projects') || '[]');
      const settings = JSON.parse(localStorage.getItem('globalSettings') || '{}');
      
      const data = {
        projects,
        settings,
        exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promeasure-export-${Date.now()}.json`;
      a.click();
    }
  </script>
</body>
</html>
```

### Script de Importação

Crie `scripts/import-from-json.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';

const prisma = new PrismaClient();

interface ExportedData {
  projects: any[];
  settings: any;
  exportDate: string;
}

async function importData(filePath: string, organizationId: string, userId: string) {
  const json = await fs.readFile(filePath, 'utf-8');
  const data: ExportedData = JSON.parse(json);
  
  console.log(`📦 Importing ${data.projects.length} projects...`);
  
  for (const localProject of data.projects) {
    console.log(`  📁 ${localProject.name}...`);
    
    // 1. Criar projeto
    const project = await prisma.project.create({
      data: {
        name: localProject.name,
        companyName: localProject.companyName,
        location: localProject.location,
        status: localProject.status || 'ACTIVE',
        contractTotal: localProject.contractTotalOverride || 0,
        bdi: localProject.bdi || 0,
        measurementNumber: localProject.measurementNumber || 0,
        referenceDate: new Date(localProject.referenceDate),
        logoUrl: null, // Upload separado se necessário
        strictMode: localProject.config?.strict || false,
        printCards: localProject.config?.printCards ?? true,
        printSubtotals: localProject.config?.printSubtotals ?? true,
        showSignatures: localProject.config?.showSignatures ?? true,
        organizationId,
        creatorId: userId,
      },
    });
    
    // 2. Importar WorkItems
    if (localProject.items?.length > 0) {
      const itemsData = localProject.items.map((item: any) => ({
        description: item.name || item.description,
        type: item.type === 'category' ? 'CATEGORY' : 'ITEM',
        wbs: item.wbs || '1',
        order: item.order || 0,
        unit: item.unit || 'UN',
        code: item.cod,
        source: item.fonte,
        contractQuantity: item.contractQuantity || 0,
        unitPrice: item.unitPrice || 0,
        unitPriceNoBdi: item.unitPriceNoBdi || 0,
        contractTotal: item.contractTotal || 0,
        previousQuantity: item.previousQuantity || 0,
        previousTotal: item.previousTotal || 0,
        currentQuantity: item.currentQuantity || 0,
        currentTotal: item.currentTotal || 0,
        currentPercentage: item.currentPercentage || 0,
        accumulatedQuantity: item.accumulatedQuantity || 0,
        accumulatedTotal: item.accumulatedTotal || 0,
        accumulatedPercentage: item.accumulatedPercentage || 0,
        balanceQuantity: item.balanceQuantity || 0,
        balanceTotal: item.balanceTotal || 0,
        parentId: item.parentId || null,
        projectId: project.id,
      }));
      
      await prisma.workItem.createMany({ data: itemsData });
      console.log(`    ✅ ${itemsData.length} work items`);
    }
    
    // 3. Importar Expenses
    if (localProject.expenses?.length > 0) {
      const expensesData = localProject.expenses.map((exp: any) => ({
        description: exp.description,
        entityName: exp.entityName,
        type: exp.type.toUpperCase(),
        itemType: exp.itemType === 'category' ? 'CATEGORY' : 'ITEM',
        wbs: exp.wbs || '1',
        order: exp.order || 0,
        date: new Date(exp.date),
        paymentDate: exp.paymentDate ? new Date(exp.paymentDate) : null,
        unit: exp.unit || 'UN',
        quantity: exp.quantity || 0,
        unitPrice: exp.unitPrice || 0,
        discountValue: exp.discountValue,
        discountPercent: exp.discountPercentage,
        amount: exp.amount || 0,
        isPaid: exp.isPaid || false,
        linkedWorkItemId: exp.linkedWorkItemId,
        parentId: exp.parentId,
        projectId: project.id,
      }));
      
      await prisma.projectExpense.createMany({ data: expensesData });
      console.log(`    ✅ ${expensesData.length} expenses`);
    }
    
    // 4. Importar Historical Snapshots
    if (localProject.history?.length > 0) {
      for (const snapshot of localProject.history) {
        await prisma.measurementSnapshot.create({
          data: {
            projectId: project.id,
            measurementNumber: snapshot.measurementNumber,
            referenceDate: new Date(snapshot.date),
            contractTotal: snapshot.totals.contract,
            periodTotal: snapshot.totals.period,
            accumulatedTotal: snapshot.totals.accumulated,
            progressPercent: snapshot.totals.progress,
            itemsSnapshot: snapshot.items,
          },
        });
      }
      console.log(`    ✅ ${localProject.history.length} snapshots`);
    }
    
    // 5. Importar Journal Entries
    if (localProject.journal?.entries?.length > 0) {
      for (const entry of localProject.journal.entries) {
        await prisma.journalEntry.create({
          data: {
            timestamp: new Date(entry.timestamp),
            type: entry.type,
            category: entry.category,
            title: entry.title,
            description: entry.description,
            weatherStatus: entry.weatherStatus,
            photoUrls: entry.photoUrls || [],
            linkedItemId: entry.linkedItemId,
            projectId: project.id,
            authorId: userId,
          },
        });
      }
      console.log(`    ✅ ${localProject.journal.entries.length} journal entries`);
    }
    
    // 6. Criar Tema
    if (localProject.theme) {
      await prisma.projectTheme.create({
        data: {
          projectId: project.id,
          fontFamily: localProject.theme.fontFamily || 'Inter',
          primary: localProject.theme.primary || '#000000',
          accent: localProject.theme.accent || '#2563eb',
          accentText: localProject.theme.accentText || '#ffffff',
          border: localProject.theme.border || '#000000',
          currencySymbol: localProject.theme.currencySymbol || 'R$',
          headerTheme: localProject.theme.header,
          categoryTheme: localProject.theme.category,
          footerTheme: localProject.theme.footer,
          kpiHighlightTheme: localProject.theme.kpiHighlight,
        },
      });
    }
  }
  
  console.log('\n✅ Import completed!');
}

// Uso
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: tsx scripts/import-from-json.ts <file.json> <orgId> <userId>');
  process.exit(1);
}

importData(args[0], args[1], args[2])
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Execute:
```bash
npx tsx scripts/import-from-json.ts exported-data.json org_xxx user_yyy
```

## 🔍 Comandos Úteis do Prisma

### Visualizar Banco de Dados
```bash
npx prisma studio
# Abre interface web em http://localhost:5555
```

### Reset Completo
```bash
npx prisma migrate reset
# ⚠️ CUIDADO: Apaga todos os dados!
```

### Criar Nova Migração
```bash
npx prisma migrate dev --name add_new_field
```

### Verificar Status
```bash
npx prisma migrate status
```

### Deploy em Produção
```bash
npx prisma migrate deploy
npx prisma generate
```

## 📊 Verificação Pós-Migração

Execute este script para validar:

```typescript
// scripts/verify-migration.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const stats = {
    organizations: await prisma.organization.count(),
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    workItems: await prisma.workItem.count(),
    expenses: await prisma.projectExpense.count(),
    snapshots: await prisma.measurementSnapshot.count(),
  };
  
  console.table(stats);
  
  // Verificar integridade
  const orphanItems = await prisma.workItem.count({
    where: { projectId: null }
  });
  
  if (orphanItems > 0) {
    console.error(`❌ Found ${orphanItems} orphan work items!`);
  } else {
    console.log('✅ All work items have valid projectId');
  }
}

verify().finally(() => prisma.$disconnect());
```

## 🔐 Segurança

### Hashing de Senhas

```typescript
import bcrypt from 'bcryptjs';

// Criar hash
const hash = await bcrypt.hash(password, 10);

// Verificar
const isValid = await bcrypt.compare(password, hash);
```

### Row-Level Security (PostgreSQL)

```sql
-- Habilitar RLS em todas as tabelas principais
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectExpense" ENABLE ROW LEVEL SECURITY;

-- Criar política de isolamento
CREATE POLICY org_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_org_id', true));
```

Configurar no código:
```typescript
await prisma.$executeRaw`
  SET app.current_org_id = ${organizationId}
`;
```

## 🚨 Troubleshooting

### Erro: "Can't reach database server"
```bash
# Verificar se PostgreSQL está rodando
brew services list
# ou
sudo systemctl status postgresql

# Verificar conexão
psql -U postgres -h localhost
```

### Erro: "Migration failed"
```bash
# Ver logs detalhados
npx prisma migrate dev --create-only
# Editar migration em prisma/migrations/xxx/migration.sql
npx prisma migrate dev
```

### Performance lenta
```sql
-- Adicionar índices manualmente se necessário
CREATE INDEX idx_workitem_project_wbs ON "WorkItem"("projectId", "wbs");
CREATE INDEX idx_expense_project_date ON "ProjectExpense"("projectId", "date");
```

## 📚 Próximos Passos

1. ✅ Configurar autenticação (NextAuth.js)
2. ✅ Implementar API Routes
3. ✅ Migrar componentes React para usar Prisma
4. ✅ Setup de testes (Jest + Prisma Mock)
5. ✅ Deploy (Vercel + Neon/Supabase)

---

**Need help?** Consulte a [documentação oficial do Prisma](https://www.prisma.io/docs)
