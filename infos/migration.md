# 🚀 ProMeasure Pro - Migração para PostgreSQL + Prisma

## 📦 Conteúdo da Entrega

Este pacote contém tudo que você precisa para migrar o ProMeasure Pro de `localStorage` para um banco de dados PostgreSQL usando Prisma ORM.

### Arquivos Incluídos

```
📁 prisma/
  ├── schema.prisma          # Schema completo do banco de dados
  ├── seed.ts                # Script para popular dados de teste
  ├── ARCHITECTURE.md        # Decisões de modelagem e arquitetura
  ├── SETUP.md               # Guia passo-a-passo de instalação
  └── API_EXAMPLES.md        # Exemplos de rotas de API

📄 .env.example              # Template de variáveis de ambiente
```

---

## ⚡ Quick Start (5 minutos)

### 1. Instalar Dependências
```bash
npm install prisma @prisma/client bcryptjs
npm install -D @types/bcryptjs tsx
```

### 2. Configurar Banco de Dados
```bash
# Copiar template de variáveis
cp .env.example .env

# Editar com suas credenciais
# DATABASE_URL="postgresql://user:password@localhost:5432/promeasure"
```

### 3. Executar Migração
```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Verificar
```bash
npx prisma studio
# Abre interface em http://localhost:5555
```

✅ **Pronto!** Você tem um banco de dados funcional com dados de exemplo.

---

## 🎯 Principais Características do Schema

### ✨ Multi-Tenancy Robusto
- **Organizações** isoladas com planos FREE/PRO/ENTERPRISE
- **Controle granular** de acesso por projeto via `ProjectMember`
- **Soft deletes** em todas as entidades principais

### 💰 Precisão Financeira
- Tipos `Decimal(18,2)` para evitar erros de ponto flutuante
- BDI configurável por projeto
- Rastreamento de custos (mão de obra, materiais, receitas)

### 📊 Hierarquia de WorkItems (EAP/WBS)
- **Representação flat** com `parentId` para performance
- **Reconstrução virtual** em memória (compatível com seu código atual)
- Campos: `wbs`, `order`, `type` (CATEGORY/ITEM)

### 🕰️ Time Machine (Snapshots)
- Histórico imutável de medições
- Estado completo congelado em JSON
- Auditoria retroativa de qualquer período

### 🔒 Audit Trail Completo
- Registro de todas as ações (CREATE/UPDATE/DELETE)
- Snapshot de valores antigos/novos em JSONB
- Rastreamento de IP e User Agent

---

## 📋 Limites por Tier (Implementação)

### Como Funciona

Os limites são armazenados na tabela `Organization`:
```prisma
model Organization {
  planTier      PlanTier  // FREE, PRO, ENTERPRISE
  projectLimit  Int       // 3, 50, -1 (unlimited)
  userLimit     Int       // 2, 10, -1
  storageLimit  BigInt    // 100MB, 10GB, unlimited
}
```

### Validação na API

```typescript
import { checkProjectLimit } from '@/lib/tier-validation';

// Antes de criar um projeto
await checkProjectLimit(organizationId);

// Se estiver no limite, lança erro:
// "Project limit reached (3). Upgrade to PRO plan."
```

Veja exemplos completos em `prisma/API_EXAMPLES.md`.

---

## 🔄 Migração de Dados Existentes

### Exportar do LocalStorage

1. Abra seu app atual
2. Execute no console:
```javascript
const data = {
  projects: JSON.parse(localStorage.getItem('projects') || '[]'),
  settings: JSON.parse(localStorage.getItem('globalSettings') || '{}'),
};
console.log(JSON.stringify(data, null, 2));
// Copiar output para arquivo data.json
```

### Importar para PostgreSQL

```bash
# Usar script fornecido em SETUP.md
npx tsx scripts/import-from-json.ts data.json <orgId> <userId>
```

---

## 🏗️ Decisões de Arquitetura (Highlights)

### Por que Flattened WorkItems?
- ✅ **Performance**: INSERT/UPDATE simples, sem cascata
- ✅ **Queries rápidas**: `WHERE projectId = ?` retorna tudo
- ✅ **Compatibilidade**: Seu `treeService.ts` já faz reconstrução

### Por que JSONB para Snapshots?
- ✅ **Imutabilidade**: Estado nunca muda após criação
- ✅ **Performance**: Não precisa reconstruir árvore histórica
- ✅ **Flexibilidade**: Schema pode evoluir sem migração

### Por que Soft Deletes?
- ✅ **Recuperação**: Dados podem ser restaurados
- ✅ **Auditoria**: Histórico completo preservado
- ✅ **Compliance**: LGPD/GDPR (direito ao esquecimento)

Leia mais em `prisma/ARCHITECTURE.md`.

---

## 📊 Estrutura de Dados (Resumo Visual)

```
Organization (Construtora ABC)
  │
  ├─ Users (2-10 usuários dependendo do tier)
  │   ├─ João Silva (ADMIN)
  │   └─ Maria Santos (ENGINEER)
  │
  ├─ ProjectGroups (Pastas de organização)
  │   └─ Obras 2024
  │
  └─ Projects (3-50 projetos dependendo do tier)
      ├─ Reforma da Escola Municipal
      │   ├─ WorkItems (Estrutura Analítica)
      │   │   ├─ 1. SERVIÇOS PRELIMINARES (categoria)
      │   │   │   ├─ 1.1 Mobilização (item)
      │   │   │   └─ 1.2 Placa de obra (item)
      │   │   └─ 2. ALVENARIA E ESTRUTURA (categoria)
      │   │
      │   ├─ MeasurementSnapshots (Time Machine)
      │   │   ├─ Medição #1 (01/02/2024)
      │   │   └─ Medição #2 (01/03/2024)
      │   │
      │   ├─ ProjectExpenses (Gestão Financeira)
      │   │   ├─ Cimento (Material)
      │   │   └─ Pedreiro - Jan/24 (Mão de obra)
      │   │
      │   ├─ JournalEntries (Diário de Obra)
      │   │   ├─ "Início da Alvenaria" (MANUAL)
      │   │   └─ "Item atingiu 100%" (AUTO)
      │   │
      │   └─ ProjectMembers (Controle de Acesso)
      │       ├─ João Silva (ADMIN)
      │       └─ Maria Santos (WRITE)
      │
      └─ AuditLogs (Rastreamento global)
```

---

## 🔐 Segurança

### Autenticação
- Senhas hasheadas com `bcrypt`
- JWT para sessões
- Exemplo de implementação em `API_EXAMPLES.md`

### Row-Level Security (RLS)
```sql
-- PostgreSQL nativo para isolamento multi-tenant
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON "Project"
  USING ("organizationId" = current_setting('app.current_org_id'));
```

### Proteção contra SQL Injection
- ✅ Prisma usa prepared statements automaticamente
- ✅ Validação de tipos em TypeScript
- ✅ Zod para validação de input

---

## 📈 Performance

### Índices Otimizados
```prisma
@@index([projectId])       // Queries por projeto
@@index([organizationId])  // Isolamento multi-tenant
@@index([parentId])        // Reconstrução de árvores
@@index([wbs])             // Busca por numeração
```

### Queries Eficientes
```typescript
// ❌ Evite: N+1 queries
for (const project of projects) {
  const items = await prisma.workItem.findMany({
    where: { projectId: project.id }
  });
}

// ✅ Use: Include/Select
const projects = await prisma.project.findMany({
  include: {
    workItems: true,
    _count: { select: { members: true } }
  }
});
```

---

## 🧪 Testes

### Setup de Testes
```bash
npm install -D jest @types/jest ts-jest
npm install -D @prisma/client prisma
```

### Exemplo de Teste
```typescript
import { POST } from '@/app/api/projects/route';

describe('Projects API', () => {
  it('should enforce tier limits', async () => {
    // Mock de organização no limite FREE
    await expect(
      POST(/* ... */)
    ).rejects.toThrow('Project limit reached');
  });
});
```

Veja mais em `API_EXAMPLES.md`.

---

## 🚢 Deploy

### Recomendações de Hosting

**Backend (PostgreSQL)**:
- 🥇 **Neon** - Serverless PostgreSQL, Free tier generoso
- 🥈 **Supabase** - Inclui auth, storage, real-time
- 🥉 **Railway** - Deploy simples, PostgreSQL incluído

**Application**:
- **Vercel** - Ideal para Next.js (criadores do framework)
- **Netlify** - Alternativa sólida
- **Railway** - Full-stack em uma plataforma

### Checklist de Deploy
- [ ] Configurar `DATABASE_URL` (production)
- [ ] Executar `npx prisma migrate deploy`
- [ ] Configurar variáveis de ambiente (Stripe, S3, etc)
- [ ] Habilitar Connection Pooling (PgBouncer)
- [ ] Configurar backups automáticos
- [ ] Setup de monitoramento (Sentry, LogRocket)

---

## 📚 Próximos Passos

1. ✅ **Ler `SETUP.md`** - Guia detalhado de instalação
2. ✅ **Revisar `schema.prisma`** - Entender as tabelas
3. ✅ **Estudar `API_EXAMPLES.md`** - Implementar rotas
4. ✅ **Migrar dados** - Usar scripts fornecidos
5. ✅ **Testar** - Validar integridade dos dados
6. ✅ **Deploy** - Colocar em produção

---

## 🆘 Suporte

### Documentação Oficial
- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs)
- [Next.js Docs](https://nextjs.org/docs)

### Troubleshooting Comum

**Erro: "Can't reach database server"**
```bash
# Verificar se PostgreSQL está rodando
brew services list  # macOS
sudo systemctl status postgresql  # Linux
```

**Performance lenta**
```sql
-- Adicionar índices customizados
CREATE INDEX idx_custom ON "WorkItem"("projectId", "type", "wbs");
```

**Limite de conexões**
- Use Connection Pooling (PgBouncer)
- Configure `connection_limit` na DATABASE_URL

---

## 🎉 Conclusão

Este schema foi projetado com rigor técnico para escalar de **1 a 10.000 organizações** mantendo:

- ✅ **Isolamento total** entre tenants
- ✅ **Precisão financeira** absoluta
- ✅ **Auditoria completa** de todas as ações
- ✅ **Performance otimizada** para grandes volumes

**Pronto para transformar o ProMeasure Pro em um SaaS de classe mundial!** 🚀

---

*Desenvolvido para profissionais que não aceitam margem de erro.*

**Dúvidas?** Consulte os arquivos de documentação incluídos.