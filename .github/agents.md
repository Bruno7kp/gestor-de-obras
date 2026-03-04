# Agents routing for Canteiro Digital

This file defines how AI agents should choose context and execute changes in this repository.

## Priority order (highest first)
1. User explicit request in chat.
2. `.github/copilot-instructions.md`.
3. Playbooks in `.github/ai/playbooks/`.
4. Existing code patterns in the target module.

If sources conflict, follow the higher-priority source and explain assumptions in the final response.

## Default execution profile
- Prefer minimal and surgical changes.
- Never change architecture unless explicitly requested.
- Always validate the touched area first (targeted checks) before broader checks.
- Keep multi-tenant isolation (`instanceId`) and project access guarantees.

## Task routing

### 1) Schema / migration / seed / scripts
Use `.github/ai/playbooks/migrations-and-scripts.md`.

Trigger when request includes:
- Prisma schema changes
- migration creation/fix
- seed changes
- import/export/backfill scripts

### 2) Permission / guest access / data consistency / import-export / pdf
Use `.github/ai/playbooks/system-critical-rules.md`.

Trigger when request includes:
- permissions and role updates
- invited users / external project members
- multi-table consistency and transactional writes
- data export/import
- PDF generation/reporting

## Mandatory delivery checklist
- Implement root-cause fix, not only symptom patch.
- Update relevant types/services/docs together when adding new fields.
- Preserve audit logging on all backend CREATE/UPDATE/DELETE flows.
- Include a short validation summary (what was run and outcome).
- Report assumptions and unresolved risks clearly.
