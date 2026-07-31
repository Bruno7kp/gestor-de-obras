/**
 * dedupe-material-forecasts.ts
 *
 * Repair script for duplicated MaterialForecast rows (Compras tab).
 *
 * Root causes (fixed in code separately):
 *   1. Importing an Excel planning re-ran the normal create/update diff-sync
 *      right after the backend already replaced everything, redundantly
 *      resubmitting the same items (components/PlanningView.tsx handleImportPlanning).
 *   2. When that resubmission hit a client-generated id that already existed,
 *      createForecast created a brand new row instead of reusing the
 *      existing one (backend/src/planning/planning.service.ts createForecast).
 *   3. Separately, rapid repeated clicks on an "add item" control with no
 *      debounce could create many near-identical rows (one per click) for
 *      the same material.
 *
 * This script finds groups of MaterialForecast rows in the same project that
 * are identical in every field that defines "the same purchase" (description,
 * unit, quantity, price, dates, status, supplier, group, category — but not
 * id/order/paymentProof/createdById), and removes the extra copies, keeping
 * exactly one per group. It also removes the ProjectExpense row that shares
 * the forecast's id (expenses are 1:1 with ordered/delivered forecasts by
 * shared id — see syncExpenseForForecast) and any SupplyGroup left empty by
 * the deletion, mirroring what planning.service.ts's own deleteForecast does.
 *
 * Two situations are deliberately NOT auto-fixed, only reported, because the
 * right fix depends on what actually happened at the construction site, not
 * on anything derivable from the data:
 *   - More than one row in a group has a linked expense with a payment
 *     proof attached (real evidence of payment on more than one row).
 *   - The group looks like a small quantity (<=1) repeated 5+ times for the
 *     same cheap item — this matches a "held down / spammed the add button"
 *     pattern seen in production (e.g. 47 rows of "PREGO 19X36" qty=1 each),
 *     where the correct fix might be to MERGE quantities into one row
 *     instead of deleting 46 of them, which would silently erase ~98% of
 *     the recorded cost. Confirm with whoever entered the data first.
 *
 * Usage:
 *   DRY_RUN=1 ts-node scripts/dedupe-material-forecasts.ts                # preview only
 *   ts-node scripts/dedupe-material-forecasts.ts                           # apply fixes
 *   PROJECT_ID=<uuid> DRY_RUN=1 ts-node scripts/dedupe-material-forecasts.ts  # scope to one project
 */
import 'dotenv/config';
import { PrismaClient, MaterialForecast, ProjectExpense } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const PROJECT_ID = process.env.PROJECT_ID;

// Below this many duplicate rows of a qty<=1 item, treat it as a normal
// full-purchase duplicate (auto-fixable) rather than a possible
// quantity-fractioned-into-clicks case.
const UNIT_CLICK_SUSPECT_THRESHOLD = 5;

function normalizeMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function netAmount(f: Pick<MaterialForecast, 'quantityNeeded' | 'unitPrice' | 'discountValue'>): number {
  const gross = f.quantityNeeded * f.unitPrice;
  return Math.max(0, normalizeMoney(gross - (f.discountValue ?? 0)));
}

function groupKey(f: MaterialForecast): string {
  return JSON.stringify([
    f.description.trim().toLowerCase(),
    f.unit,
    f.quantityNeeded,
    f.unitPrice,
    f.discountValue ?? null,
    f.discountPercentage ?? null,
    f.estimatedDate,
    f.purchaseDate ?? null,
    f.deliveryDate ?? null,
    f.status,
    f.isPaid,
    f.isCleared,
    f.supplierId ?? null,
    f.supplyGroupId ?? null,
    f.categoryId ?? null,
  ]);
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const separator = '='.repeat(70);

  console.log(`\n${separator}`);
  console.log(
    DRY_RUN
      ? '  DRY RUN — nenhuma alteração será gravada'
      : '  MODO PRODUÇÃO — alterações serão gravadas no banco',
  );
  if (PROJECT_ID) console.log(`  Escopo: projeto ${PROJECT_ID}`);
  console.log(`${separator}\n`);

  const projects = await prisma.project.findMany({
    where: PROJECT_ID ? { id: PROJECT_ID } : undefined,
    select: { id: true, name: true },
  });

  let totalGroups = 0;
  let totalRowsRemoved = 0;
  let totalValueRemoved = 0;
  let totalFlaggedGroups = 0;

  for (const project of projects) {
    const planning = await prisma.projectPlanning.findUnique({
      where: { projectId: project.id },
      select: { id: true },
    });
    if (!planning) continue;

    const forecasts = await prisma.materialForecast.findMany({
      where: { projectPlanningId: planning.id },
    });
    if (forecasts.length === 0) continue;

    const groups = new Map<string, MaterialForecast[]>();
    for (const f of forecasts) {
      const key = groupKey(f);
      const arr = groups.get(key);
      if (arr) arr.push(f);
      else groups.set(key, [f]);
    }

    const dupGroups = [...groups.values()].filter((g) => g.length > 1);
    if (dupGroups.length === 0) continue;

    const allIds = forecasts.map((f) => f.id);

    const expenses = await prisma.projectExpense.findMany({
      where: { id: { in: allIds } },
    });
    const expenseById = new Map<string, ProjectExpense>(
      expenses.map((e) => [e.id, e]),
    );

    const auditCreates = await prisma.auditLog.findMany({
      where: {
        entityId: { in: allIds },
        model: 'MaterialForecast',
        action: 'CREATE',
      },
      select: { entityId: true, createdAt: true },
    });
    const createdAtById = new Map<string, number>();
    for (const a of auditCreates) {
      const t = a.createdAt.getTime();
      const cur = createdAtById.get(a.entityId);
      if (cur === undefined || t < cur) createdAtById.set(a.entityId, t);
    }

    console.log(`\nProjeto "${project.name}" (${project.id})`);

    for (const group of dupGroups) {
      totalGroups++;
      const ids = group.map((f) => f.id);
      const withProof = group.filter((f) => expenseById.get(f.id)?.paymentProof);
      // Duplicated rows tend to inherit the SAME uploaded receipt (it was set
      // once, then copied along with the rest of the row when duplicated).
      // Only treat this as ambiguous when the rows point to genuinely
      // different files — that's real evidence of more than one payment.
      const distinctProofs = new Set(
        withProof.map((f) => expenseById.get(f.id)!.paymentProof as string),
      );

      if (distinctProofs.size > 1) {
        totalFlaggedGroups++;
        console.log(
          `  [REVISAR MANUAL] "${group[0].description}" — ${group.length} linhas com` +
            ` ${distinctProofs.size} comprovantes de pagamento DIFERENTES vinculados` +
            ` (não dá pra escolher automaticamente qual manter). IDs: ${ids.map(shortId).join(', ')}`,
        );
        continue;
      }

      if (group[0].quantityNeeded <= 1 && group.length >= UNIT_CLICK_SUSPECT_THRESHOLD) {
        totalFlaggedGroups++;
        console.log(
          `  [REVISAR MANUAL] "${group[0].description}" — ${group.length} linhas de` +
            ` quantidade ${group[0].quantityNeeded} cada. Pode ser 1 compra duplicada` +
            ` ${group.length}x (apagar o resto) ou ${group.length} unidades reais` +
            ` lançadas 1 a 1 (juntar numa linha só de quantidade ${group.length}).` +
            ` Confirme antes de decidir. IDs: ${ids.map(shortId).join(', ')}`,
        );
        continue;
      }

      // Prefer keeping a row that carries the (single, shared-or-absent)
      // proof, so we never delete the only row(s) referencing an uploaded
      // file; among those, keep the earliest created.
      const candidates = withProof.length > 0 ? withProof : group;
      const sorted = [...candidates].sort((a, b) => {
        const at = createdAtById.get(a.id) ?? Infinity;
        const bt = createdAtById.get(b.id) ?? Infinity;
        if (at !== bt) return at - bt;
        return a.id < b.id ? -1 : 1;
      });
      const keep = sorted[0];

      const toRemove = group.filter((f) => f.id !== keep.id);
      const removedValue = toRemove.reduce((sum, f) => sum + netAmount(f), 0);

      console.log(
        `  [DEDUP] "${keep.description}" (${keep.unit}, qtd ${keep.quantityNeeded},` +
          ` R$ ${keep.unitPrice}) — mantendo ${shortId(keep.id)}, removendo` +
          ` ${toRemove.length}: ${toRemove.map((f) => shortId(f.id)).join(', ')}` +
          ` | valor removido: R$ ${removedValue.toFixed(2)}`,
      );

      totalRowsRemoved += toRemove.length;
      totalValueRemoved += removedValue;

      if (!DRY_RUN) {
        const removeIds = toRemove.map((f) => f.id);
        const groupIds = [
          ...new Set(
            toRemove
              .map((f) => f.supplyGroupId)
              .filter((id): id is string => !!id),
          ),
        ];

        await prisma.$transaction(async (tx) => {
          await tx.projectExpense.deleteMany({ where: { id: { in: removeIds } } });
          await tx.materialForecast.deleteMany({ where: { id: { in: removeIds } } });

          for (const gid of groupIds) {
            const remaining = await tx.materialForecast.count({
              where: { supplyGroupId: gid },
            });
            if (remaining === 0) {
              await tx.supplyGroup.deleteMany({ where: { id: gid } });
            }
          }
        });
      }
    }
  }

  console.log(`\n${separator}`);
  console.log('  RESUMO');
  console.log(`${separator}`);
  console.log(`  Grupos com duplicata encontrados: ${totalGroups}`);
  console.log(`  Grupos corrigidos automaticamente: ${totalGroups - totalFlaggedGroups}`);
  console.log(`  Linhas removidas:                 ${totalRowsRemoved}`);
  console.log(`  Valor total removido:             R$ ${totalValueRemoved.toFixed(2)}`);
  console.log(`  Grupos sinalizados p/ revisão:     ${totalFlaggedGroups}`);
  if (DRY_RUN) {
    console.log(
      `\n  ⚠  DRY RUN — execute sem DRY_RUN=1 para aplicar as correções.`,
    );
  } else {
    console.log(`\n  ✓  Correções aplicadas com sucesso.`);
  }
  console.log('');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
