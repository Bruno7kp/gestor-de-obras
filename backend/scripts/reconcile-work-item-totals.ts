/**
 * reconcile-work-item-totals.ts
 *
 * Repair script for the "acumulado caindo entre medições" bug.
 *
 * Bug (fixed in code separately, services/projectService.ts closeMeasurement):
 * the WBS quantity/percentage editors (components/WbsView.tsx updateItemQuantity /
 * updateItemPercentage) only ever persist currentQuantity/currentPercentage —
 * currentTotal is recalculated fresh only for on-screen display
 * (treeService.processRecursive) and never written back to WorkItem. Closing a
 * measurement rotated previousTotal += currentTotal using that stale/zeroed
 * currentTotal, silently losing the period's real value from what gets
 * persisted (previousTotal), even though the totals shown at close time looked
 * correct.
 *
 * This script does two DIFFERENT kinds of fix, deliberately kept separate:
 *
 * 1. currentTotal (safe, applied to every project in PROJECT_IDS): whenever
 *    currentQuantity > 0 but currentTotal is still 0, recompute
 *    currentTotal = truncate(currentQuantity * unitPrice). This is a single
 *    fresh truncation for the open period — no precision trade-off, always
 *    an unambiguous improvement.
 *
 * 2. previousTotal (a trade-off, applied ONLY to RECONSTRUCT_PROJECT_IDS):
 *    previousTotal is a frozen ACCUMULATOR — each close does
 *    previousTotal = truncate(previousTotal + currentTotal), and summing
 *    already-truncated per-period deltas is NOT the same as
 *    truncate(combinedQuantity * unitPrice) (see the "bug do centavo" from
 *    06/07, commit 1a9da26 — truncate(a·p) + truncate(b·p) ≠ truncate((a+b)·p)).
 *    So recomputing previousTotal from quantity is only done for items whose
 *    accumulator is KNOWN to be wrong (a close silently dropped a period
 *    because of bug #1) — reconstructing it is the best available option
 *    there (no per-period history survives to replay exactly), accepting a
 *    cents-level rounding difference in exchange for fixing a much bigger
 *    error. For every other item, the stored previousTotal is trusted
 *    as-is and left untouched, exactly like treeService.forceRecalculate /
 *    processRecursive already do (storedPreviousTotal > 0 ? trust it :
 *    recompute) — recomputing indiscriminately for items that were never
 *    broken just reintroduces the already-fixed centavo bug for no reason.
 *
 * This only touches the CURRENT live WorkItem rows (what the Medição screen
 * shows today and what feeds the next close). Already-issued ATAs
 * (MeasurementSnapshot) are NOT rewritten — they stay as the historical
 * record of what was reported at the time.
 *
 * Usage:
 *   DRY_RUN=1 ts-node scripts/reconcile-work-item-totals.ts   # preview only
 *   ts-node scripts/reconcile-work-item-totals.ts               # apply fixes
 *   PROJECT_IDS=<id1>,<id2>            # projects to scan for the currentTotal fix (default: all known-affected)
 *   RECONSTRUCT_PROJECT_IDS=<id1>,<id2> # subset that also gets previousTotal reconstructed (default: the 2 confirmed cases)
 */
import 'dotenv/config';
import { PrismaClient, WorkItem } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

// Projetos com sinal do bug confirmado em 31/07 (currentQuantity > 0 e
// currentTotal ainda 0, ou histórico fechado já regredido).
const DEFAULT_PROJECT_IDS = [
  '821364a2-8c95-4a21-b4a9-5679c77d9ca8', // ATA MANUTENÇÃO PREDIAL (LOTE 1) - SECRETÁRIA... — histórico já regrediu
  'a48166c9-6c54-4af7-bf76-f2af3e04c296', // idem, mesmo nome — histórico já regrediu
  '2c9d4fcc-e0f1-4f94-8960-d4b0dac8fb4e', // idem, mesmo nome — só medição aberta, histórico ok
  '05ec5c99-5408-4f91-9493-f9447219ff6b', // AMPLIAÇÃO ESCOLA MUNICIPAL DEPUTADO TEMISTOCLES TEIXEIRA
  '80536d37-2047-483f-ab7d-8c94d871fa46', // CASAS SFM
];

// Só esses têm histórico FECHADO comprovadamente regredido (comparei o
// itemsSnapshot de ATAs consecutivas). Reconstruir previousTotal por
// quantidade é o único jeito de recuperar o valor perdido, mas introduz uma
// diferença de centavos por causa da retruncagem — não aplicar a mais
// nenhum projeto sem confirmar a mesma coisa antes.
const DEFAULT_RECONSTRUCT_PROJECT_IDS = [
  '821364a2-8c95-4a21-b4a9-5679c77d9ca8',
  'a48166c9-6c54-4af7-bf76-f2af3e04c296',
];

const PROJECT_IDS = process.env.PROJECT_IDS
  ? process.env.PROJECT_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_PROJECT_IDS;

const RECONSTRUCT_PROJECT_IDS = new Set(
  process.env.RECONSTRUCT_PROJECT_IDS
    ? process.env.RECONSTRUCT_PROJECT_IDS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_RECONSTRUCT_PROJECT_IDS,
);

function truncate(value: number): number {
  return Math.trunc(value * 100) / 100;
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
  console.log(`  Projetos escaneados:              ${PROJECT_IDS.join(', ')}`);
  console.log(`  Projetos c/ previousTotal reconstruído: ${[...RECONSTRUCT_PROJECT_IDS].join(', ') || '(nenhum)'}`);
  console.log(`${separator}\n`);

  let totalItemsChanged = 0;
  let totalOldAccumulated = 0;
  let totalNewAccumulated = 0;

  for (const projectId of PROJECT_IDS) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, bdi: true },
    });

    if (!project) {
      console.log(`[SKIP] Projeto ${projectId} não encontrado.\n`);
      continue;
    }

    const items = await prisma.workItem.findMany({
      where: { projectId, type: { not: 'category' } },
    });

    if (items.length === 0) {
      console.log(`[SKIP] Projeto "${project.name}" sem itens.\n`);
      continue;
    }

    const reconstructPrevious = RECONSTRUCT_PROJECT_IDS.has(projectId);
    console.log(
      `\nProjeto "${project.name}" (${project.id}) — ${items.length} itens` +
        (reconstructPrevious ? ' [reconstruindo previousTotal]' : ' [só currentTotal]'),
    );

    const bdiFactor = 1 + (project.bdi || 0) / 100;
    let projectOldAccumulated = 0;
    let projectNewAccumulated = 0;
    let projectChanged = 0;

    const updates: Array<{
      item: WorkItem;
      unitPrice: number;
      contractTotal: number;
      previousTotal: number;
      currentTotal: number;
      accumulatedTotal: number;
      balanceTotal: number;
    }> = [];

    for (const item of items) {
      const unitPrice = truncate((item.unitPriceNoBdi || 0) * bdiFactor);
      const contractTotal = truncate(unitPrice * (item.contractQuantity || 0));

      // previousTotal é o acumulador congelado: só reconstruir por
      // quantidade nos projetos com regressão confirmada. Nos demais,
      // confiar sempre no valor gravado — recalcular sem necessidade
      // reintroduz a diferença de centavos da retruncagem.
      const previousTotal = reconstructPrevious
        ? truncate((item.previousQuantity || 0) * unitPrice)
        : item.previousTotal;

      // currentTotal: só mexer quando há evidência concreta de perda (tem
      // quantidade lançada mas o total ainda está zerado). Fora isso, é uma
      // truncagem única do período aberto, sem risco de retruncagem.
      const currentTotal =
        (item.currentQuantity || 0) > 0 && item.currentTotal === 0
          ? truncate((item.currentQuantity || 0) * unitPrice)
          : item.currentTotal;

      const accumulatedTotal = truncate(previousTotal + currentTotal);
      const balanceTotal = truncate(contractTotal - accumulatedTotal);

      projectOldAccumulated += item.accumulatedTotal || 0;
      projectNewAccumulated += accumulatedTotal;

      const changed =
        Math.abs(previousTotal - item.previousTotal) > 0.01 ||
        Math.abs(currentTotal - item.currentTotal) > 0.01;

      if (!changed) continue;

      projectChanged++;
      console.log(
        `  [FIX] "${item.name}" (${item.id.slice(0, 8)})` +
          `\n        previousTotal: ${item.previousTotal} -> ${previousTotal}` +
          `\n        currentTotal:  ${item.currentTotal} -> ${currentTotal}` +
          `\n        accumulated:   ${item.accumulatedTotal} -> ${accumulatedTotal}`,
      );

      updates.push({
        item,
        unitPrice,
        contractTotal,
        previousTotal,
        currentTotal,
        accumulatedTotal,
        balanceTotal,
      });
    }

    console.log(
      `  -> Projeto "${project.name}": ${projectChanged} item(ns) alterado(s)` +
        ` | acumulado do projeto: R$ ${projectOldAccumulated.toFixed(2)} -> R$ ${projectNewAccumulated.toFixed(2)}\n`,
    );

    totalItemsChanged += projectChanged;
    totalOldAccumulated += projectOldAccumulated;
    totalNewAccumulated += projectNewAccumulated;

    if (!DRY_RUN && updates.length > 0) {
      await prisma.$transaction(
        updates.map(({ item, unitPrice, contractTotal, previousTotal, currentTotal, accumulatedTotal, balanceTotal }) =>
          prisma.workItem.update({
            where: { id: item.id },
            data: { unitPrice, contractTotal, previousTotal, currentTotal, accumulatedTotal, balanceTotal },
          }),
        ),
      );
    }
  }

  console.log(`\n${separator}`);
  console.log('  RESUMO');
  console.log(`${separator}`);
  console.log(`  Itens corrigidos:        ${totalItemsChanged}`);
  console.log(`  Acumulado total antes:   R$ ${totalOldAccumulated.toFixed(2)}`);
  console.log(`  Acumulado total depois:  R$ ${totalNewAccumulated.toFixed(2)}`);
  console.log(`  Diferença:               R$ ${(totalNewAccumulated - totalOldAccumulated).toFixed(2)}`);
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
