# Plano de Migracao: LocalStorage -> Postgres

Este plano inicia a implementacao da migracao para uma API REST em NestJS + Prisma + Postgres, com deploy via Docker no droplet da DigitalOcean e envio de emails com Resend. A autenticacao sera via JWT (Passport) no backend.

## Escopo
- API REST multi-instancia (tenant) com RBAC por instancia.
- Banco Postgres com Prisma.
- Docker para backend + banco.
- Resend para emails (boas-vindas e reset de senha).
- Tela futura de super admin (gestao de instancias).

## Fases

### Fase 1 - Fundacao do backend
1. Criar projeto NestJS em `backend/`.
2. Configurar Prisma e Postgres.
3. Criar modelos base: Instance, User, Role, Permission, Subscription.
4. Implementar auth JWT (login, refresh, protecao de rotas).
5. Integrar Resend para envio de emails basicos.

### Fase 2 - Dominio core
1. Modelos de Project, WorkItem, ProjectExpense, ProjectPlanning, Journal.
2. Recursos REST por entidade (CRUD + filtros).
3. Suporte a hierarquias (WorkItem/Expense) e snapshots.

### Fase 3 - Migracao de dados
1. Exportar payload do localStorage.
2. Script de import para Postgres (ordem: instance -> users -> projects -> items -> expenses -> planning -> journal).
3. Validacao de integridade e logs.

### Fase 4 - Frontend
1. Substituir localStorage por chamadas REST.
2. Fluxo de login e guardas de rotas.
3. Tela do super admin (gestao de instancias).

## Entregaveis iniciais
- Backend NestJS + Prisma pronto para rodar no Docker.
- Endpoints base de auth e instance.
- Esquema Postgres inicial.
- Docs de entidades, escopo e recursos.
