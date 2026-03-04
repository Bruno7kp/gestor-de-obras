# Copilot instructions for Canteiro Digital

## Agent scope and routing (optimized)
- Primary router: [.github/agents.md](.github/agents.md).
- Task playbooks:
	- Migration and scripts: [.github/ai/playbooks/migrations-and-scripts.md](.github/ai/playbooks/migrations-and-scripts.md)
	- Critical system rules: [.github/ai/playbooks/system-critical-rules.md](.github/ai/playbooks/system-critical-rules.md)
- Precedence for decisions:
	1) explicit user request,
	2) this file,
	3) playbooks,
	4) existing module patterns.
- Expected behavior:
	- prefer minimal, surgical changes;
	- enforce backend authorization first (frontend gates are UX-only);
	- keep tenant/project isolation guarantees in all flows;
	- preserve/create audit logs for backend CREATE/UPDATE/DELETE;
	- validate the touched area with targeted checks before broad checks.

## Big picture
- Monorepo layout: frontend SPA in [gestor-de-obras](gestor-de-obras) and NestJS API in [gestor-de-obras/backend](gestor-de-obras/backend).
- Frontend talks to backend via REST with `credentials: 'include'`; API base is `VITE_API_URL` (see [gestor-de-obras/vite.config.ts](gestor-de-obras/vite.config.ts) and service files).
- Auth uses cookie `promeasure_token` set by `/auth/login`; permissions ride in JWT and are read via `usePermissions` on the client.
- Multi-tenant model: `Instance` is the tenant root; most entities carry `instanceId` (see [gestor-de-obras/backend/prisma/schema.prisma](gestor-de-obras/backend/prisma/schema.prisma)).
- Cross-instance access is allowed via `ProjectMember`: users can be invited to projects outside their instance; access checks use `ensureProjectAccess`/`ensureEntityAccess` (see [gestor-de-obras/backend/src/common/project-access.util.ts](gestor-de-obras/backend/src/common/project-access.util.ts)).
- Core domain logic for WBS lives in `treeService` (build tree -> processRecursive -> flattenTree) and uses `financial` utils to avoid float errors.

## Key flows and data boundaries
- Project data is normalized in `projectsApi.normalizeProject` before state usage; keep this in mind when adding fields (update normalizer + types).
- Permissions are defined in [gestor-de-obras/utils/permissions.ts](gestor-de-obras/utils/permissions.ts); UI gates should use `usePermissions()`.
- Permission sources: seeded permissions + roles in [gestor-de-obras/backend/prisma/seed.ts](gestor-de-obras/backend/prisma/seed.ts); backend assigns role permissions in services (see [gestor-de-obras/backend/src/roles/roles.service.ts](gestor-de-obras/backend/src/roles/roles.service.ts)).
- Many UI preferences persist in `localStorage` (theme, sidebar expansion, table columns).
- Backend data model is Prisma in [gestor-de-obras/backend/prisma/schema.prisma](gestor-de-obras/backend/prisma/schema.prisma).
- Instances are created/managed by SUPER_ADMIN only: UI in [gestor-de-obras/pages/SuperAdminPage.tsx](gestor-de-obras/pages/SuperAdminPage.tsx), API in [gestor-de-obras/backend/src/instances](gestor-de-obras/backend/src/instances).
- External projects: `projectsApi.listExternal` populates `externalProjects` and Sidebar renders them under "Compartilhado" (see [gestor-de-obras/hooks/useProjectState.ts](gestor-de-obras/hooks/useProjectState.ts) and [gestor-de-obras/components/Sidebar.tsx](gestor-de-obras/components/Sidebar.tsx)).

## Notifications (current state + roadmap)
- Notifications foundation is implemented in backend with Prisma models `Notification`, `NotificationRecipient`, `NotificationPreference`, and `NotificationDelivery` (see [gestor-de-obras/backend/prisma/schema.prisma](gestor-de-obras/backend/prisma/schema.prisma) and migration `20260213143000_add_notifications_foundation`).
- Backend module is active in [gestor-de-obras/backend/src/notifications](gestor-de-obras/backend/src/notifications), including endpoints for list, mark-as-read, mark-all-read, preferences, manual delivery processing, and digest preview.
- Frontend integration exists at service/type layer only (no notifications page/widget yet): [gestor-de-obras/services/notificationsApi.ts](gestor-de-obras/services/notificationsApi.ts) and [gestor-de-obras/types.ts](gestor-de-obras/types.ts).
- Permission keys `notifications.view` and `notifications.edit` are defined and seeded (see [gestor-de-obras/utils/permissions.ts](gestor-de-obras/utils/permissions.ts) and [gestor-de-obras/backend/prisma/seed.ts](gestor-de-obras/backend/prisma/seed.ts)).
- Trigger ownership moved to backend: work item completion and expense status changes emit notifications server-side; frontend no longer creates automatic journal entries from deltas.
- Journal policy change already applied: automatic “financial settlement / PAID” journal entries were removed; automatic journal remains for execution milestone and delivered materials.
- Email strategy is outbox-first (via `NotificationDelivery`) with retry/backoff and selective sending based on preferences; architecture should stay RabbitMQ-ready without making broker mandatory now.
- Current scope intentionally excludes notification UI, push channels, and mandatory background workers.

### Future plans (keep implementation aligned)
- Build notifications UI incrementally: unread badge + list first, then full center with filters by category/event/priority.
- Add user-facing preference screens (project/category/event granularity) before enabling broad email automation in production.
- Move delivery processing from manual/admin endpoint to scheduled worker/queue execution (cron or queue worker), preserving existing outbox schema.
- Add digest orchestration policies (e.g., hourly/daily) using current digest preview shape as contract baseline.
- Keep event taxonomy stable (`category`, `eventType`, `priority`, `dedupeKey`) and backward-compatible when adding new notification sources.

## Critical workflows
- Frontend dev: `npm run dev` in [gestor-de-obras/package.json](gestor-de-obras/package.json) (Vite on :3000).
- Backend dev: `npm run start:dev` in [gestor-de-obras/backend/package.json](gestor-de-obras/backend/package.json) (Nest on :3000, exposed as :4000 in docker-compose).
- Docker local stack (preferred): `docker compose -f docker-compose.yml -f docker-compose.local.yml up --build` in [gestor-de-obras](gestor-de-obras) for hot reload behind nginx on :8082.
- Prisma: `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:seed` (backend).
- Data migration from localStorage: `npm run import:localstorage` (see [gestor-de-obras/backend/scripts/import-localstorage.ts](gestor-de-obras/backend/scripts/import-localstorage.ts)).

## Prisma migrations (safe flow)
- Always create migrations locally (dev): `npm run prisma:migrate` in [gestor-de-obras/backend](gestor-de-obras/backend) and commit `backend/prisma/migrations/*`.
- Production servers must use deploy-only: `npx prisma migrate deploy` (never `migrate dev`).
- If a migration checksum mismatch occurs, do not reset production. Prefer syncing the migration folder from git and use `prisma migrate resolve --applied <migration_name>` only if already applied.
- Production Docker Compose example (from server root):
	- `docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
	- `docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml exec backend npx prisma migrate deploy`

## Conventions and patterns
- Service layer in [gestor-de-obras/services](gestor-de-obras/services) owns business logic + API calls; components should be light on logic.
- WBS calculations: use `treeService.processRecursive` + `financial.truncate/round` (avoid direct float math in UI).
- External projects are separated in state and rendered under "Compartilhado" in sidebar; keep `externalProjects` flow intact.
- Types are centralized in [gestor-de-obras/types.ts](gestor-de-obras/types.ts); add or adjust types there first.
- Uploads: frontend uses [gestor-de-obras/services/uploadService.ts](gestor-de-obras/services/uploadService.ts) -> backend `/uploads` (see [gestor-de-obras/backend/src/uploads/uploads.controller.ts](gestor-de-obras/backend/src/uploads/uploads.controller.ts)). When deleting entities with files, call `removeLocalUpload(s)` (used in planning/workforce/assets and instance cleanup).
- Modals/toasts: use shared [gestor-de-obras/components/ConfirmModal.tsx](gestor-de-obras/components/ConfirmModal.tsx) and [gestor-de-obras/hooks/useToast.ts](gestor-de-obras/hooks/useToast.ts) + [gestor-de-obras/components/ToastContainer.tsx](gestor-de-obras/components/ToastContainer.tsx) for consistent UI feedback.

## Audit logging (mandatory)
- Every backend service that performs CREATE, UPDATE, or DELETE on any entity **must** emit an audit log via `AuditService.log()`.
- `AuditService` is `@Global()` — just inject it in the constructor; no module import needed.
- Pattern: fire-and-forget with `void this.auditService.log({ ... })` so the main request is not blocked.
- Required fields: `instanceId` (always from entity context, not from JWT), `action` (`'CREATE' | 'UPDATE' | 'DELETE'`), `model` (PascalCase Prisma model name), `entityId`.
- For UPDATE: capture `before` state **before** the mutation, pass both `before` and `after` as `Record<string, unknown>` (use `JSON.parse(JSON.stringify(obj)) as Record<string, unknown>`).
- For DELETE: include `before` with the entity state before deletion.
- For CREATE: include `after` with the created entity.
- Optional: `projectId` (when operation is project-scoped), `userId` (the actor), `metadata` (extra context like `{ operation: 'setPermissions' }`).
- **Never** log sensitive data (password hashes, tokens). For password changes, log only `metadata: { operation: 'passwordChange' }`.
- Instance isolation: queries in `AuditController` and `AuditService.findById` must always filter by `instanceId` from `req.user`.
- When adding a new model/entity, also add its PT-BR label to `MODEL_LABELS` in [gestor-de-obras/pages/AuditPage.tsx](gestor-de-obras/pages/AuditPage.tsx).
- Reference implementation: see [gestor-de-obras/backend/src/audit/audit.service.ts](gestor-de-obras/backend/src/audit/audit.service.ts) and any existing service (e.g., `projects.service.ts`).
