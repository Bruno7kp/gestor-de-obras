# Playbook: System-critical rules

Use this playbook when changing logic that commonly breaks in AI-assisted edits.

## 1) Permissions and role model
- Always enforce on backend first; frontend checks are UX only.
- For new capability keys, update:
  - `gestor-de-obras/utils/permissions.ts`
  - `gestor-de-obras/backend/prisma/seed.ts`
  - any role assignment service flow if needed
- Validate both positive and negative paths (authorized and forbidden).

## 2) Invited users and cross-instance access
- Cross-instance access is valid only through project membership.
- Reuse existing guards/utilities (`ensureProjectAccess` / `ensureEntityAccess`) rather than bespoke checks.
- Never trust only `instanceId` for project-scoped entities; verify project access relationship.

## 3) Atomic consistency across tables
- Multi-entity writes must use DB transaction (`prisma.$transaction`) when partial writes would corrupt state.
- For status transitions with side effects (journal, notifications, stock, etc.), keep all dependent writes in one transactional boundary where possible.
- If external side effects exist (email/queue), persist intent first (outbox pattern) then process async.

## 4) Import/export of data
- Import:
  - validate schema and required fields before write
  - reject or report partial invalid rows deterministically
  - preserve tenant boundaries (`instanceId`) in every operation
- Export:
  - enforce permission checks before data extraction
  - avoid exposing sensitive/internal-only fields by default
  - keep stable column naming/versioning for downstream compatibility

## 5) PDF generation
- Keep generation deterministic (same input => same layout/content ordering).
- Sanitize and normalize text/date/number formatting before rendering.
- Ensure permission and tenant checks happen before building report payload.
- For large datasets, prefer paginated/streaming-friendly flow to avoid memory spikes.

## 6) Audit logging (mandatory)
- Any backend CREATE/UPDATE/DELETE must log via `AuditService.log()`.
- Include required fields and avoid sensitive values.
- For UPDATE/DELETE, capture `before` state reliably.

## Done criteria for critical changes
- Permission + tenant constraints verified.
- Transaction boundaries reviewed.
- Audit logging preserved.
- Import/export/PDF paths validated for representative sample.
