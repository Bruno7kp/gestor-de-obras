# Playbook: Migrations and scripts

Use this playbook for schema evolution, migration handling, seeds, and operational scripts.

## Goal
Ship DB changes safely across local/dev/prod without drift or data loss.

## Safe flow (Prisma)
1. Edit `gestor-de-obras/backend/prisma/schema.prisma`.
2. Generate migration locally with project scripts (`npm run prisma:migrate` in backend).
3. Commit both schema and generated migration folder.
4. Regenerate Prisma client when needed (`npm run prisma:generate`).
5. For production instructions, use deploy-only (`npx prisma migrate deploy`) and never `migrate dev`.

## Rules for migration changes
- Never rewrite an already applied production migration.
- Prefer additive changes first (`nullable`/default/backfill) then tightening constraints in a later migration.
- If data backfill is required, implement deterministic script with idempotent behavior.
- Include rollback strategy in PR description (or explicit statement that rollback is not automatic).

## Seed and permission updates
- If adding permissions or roles, update both:
  - `gestor-de-obras/utils/permissions.ts`
  - `gestor-de-obras/backend/prisma/seed.ts`
- Keep seed deterministic and rerunnable.

## Scripts (import/export/backfill)
- Place scripts under `gestor-de-obras/backend/scripts`.
- Script requirements:
  - explicit input params and dry-run mode when feasible
  - tenant-safe filters (`instanceId`) and project access invariants
  - structured logs: processed/succeeded/failed counts
  - idempotency guard (re-run should not duplicate side effects)

## Validation checklist
- Migration generated successfully.
- Prisma client generated successfully.
- Targeted module tests/build pass.
- Manual sanity query confirms expected data shape.
- No cross-instance data leakage risk introduced.
