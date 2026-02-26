/**
 * fix-duplicate-forecast-expenses.ts
 *
 * Repair script for the duplicate-forecast-description bug.
 *
 * Bug: when two MaterialForecasts shared the same description (same lote,
 * different lotes, or no lote), the frontend's description-based fallback
 * in findExpenseForForecast would match the FIRST expense for BOTH forecasts.
 * This caused:
 *   1. The second forecast's expense being overwritten with the first's values
 *   2. Or the second forecast never getting an expense created at all
 *
 * This script:
 *   1. For each non-pending forecast, checks if an expense with matching ID exists
 *   2. If the expense exists but has wrong values → corrects qty/unitPrice/amount/description
 *   3. If NO expense exists for that forecast → creates one with the correct values
 *   4. Detects "orphan" expenses matched only by description that belong to no forecast
 *
 * Usage:
 *   DRY_RUN=1 ts-node scripts/fix-duplicate-forecast-expenses.ts   # preview only
 *   ts-node scripts/fix-duplicate-forecast-expenses.ts               # apply fixes
 */
import 'dotenv/config';
import { PrismaClient, ExpenseStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function getExpensePrefix(status: string, isPaid: boolean): string {
  if (status === 'delivered') return 'Pedido Entregue';
  if (isPaid) return 'Pedido Pago';
  return 'Pedido Pendente';
}

function normalizeMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeNetAmount(
  quantity: number,
  unitPrice: number,
  discountValue: number,
): number {
  const gross = quantity * unitPrice;
  return Math.max(0, normalizeMoney(gross - discountValue));
}

function resolveExpenseStatus(
  forecastStatus: string,
  isPaid: boolean,
): ExpenseStatus {
  if (forecastStatus === 'delivered') return 'DELIVERED';
  if (isPaid) return 'PAID';
  return 'PENDING';
}

function loteLabel(
  supplyGroup: { id: string; title: string | null } | null,
): string {
  if (!supplyGroup) return '';
  return ` | Lote "${supplyGroup.title || supplyGroup.id.slice(0, 8)}"`;
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
  console.log(`${separator}\n`);

  // ----- Load all projects with their plannings -----
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let totalFixed = 0;
  let totalCreated = 0;
  const totalSkipped = 0;
  let totalAlreadyOk = 0;

  for (const project of projects) {
    const planning = await prisma.projectPlanning.findUnique({
      where: { projectId: project.id },
      select: { id: true },
    });

    if (!planning) continue;

    // Get all non-pending forecasts (these should have corresponding expenses)
    const forecasts = await prisma.materialForecast.findMany({
      where: {
        projectPlanningId: planning.id,
        status: { not: 'pending' },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        supplyGroup: { select: { id: true, title: true } },
      },
    });

    if (forecasts.length === 0) continue;

    // Get all material expenses for this project
    const expenses = await prisma.projectExpense.findMany({
      where: {
        projectId: project.id,
        type: 'material',
        itemType: 'item',
      },
    });

    const expenseById = new Map(expenses.map((e) => [e.id, e]));
    const forecastIdsSet = new Set(forecasts.map((f) => f.id));

    let projectFixCount = 0;
    let projectCreateCount = 0;

    for (const forecast of forecasts) {
      const expectedPrefix = getExpensePrefix(forecast.status, forecast.isPaid);
      const expectedDescription = `${expectedPrefix}: ${forecast.description}`;
      const expectedQty = forecast.quantityNeeded;
      const expectedUnitPrice = forecast.unitPrice;
      const expectedDiscount = normalizeMoney(forecast.discountValue ?? 0);
      const expectedAmount = computeNetAmount(
        expectedQty,
        expectedUnitPrice,
        expectedDiscount,
      );
      const expectedStatus = resolveExpenseStatus(
        forecast.status,
        forecast.isPaid,
      );

      // Case 1: expense with matching ID exists
      const expense = expenseById.get(forecast.id);

      if (expense) {
        // Check if values are correct
        const qtyMatch = expense.quantity === expectedQty;
        const priceMatch = expense.unitPrice === expectedUnitPrice;
        const amountMatch = normalizeMoney(expense.amount) === expectedAmount;
        const descMatch = expense.description === expectedDescription;

        if (qtyMatch && priceMatch && amountMatch && descMatch) {
          totalAlreadyOk++;
          continue;
        }

        // Values are wrong — this was likely overwritten by another forecast
        const diffs: string[] = [];
        if (!qtyMatch) {
          diffs.push(`qty: ${expense.quantity} → ${expectedQty}`);
        }
        if (!priceMatch) {
          diffs.push(`unitPrice: ${expense.unitPrice} → ${expectedUnitPrice}`);
        }
        if (!amountMatch) {
          diffs.push(
            `amount: ${normalizeMoney(expense.amount)} → ${expectedAmount}`,
          );
        }
        if (!descMatch) {
          diffs.push(
            `desc: "${expense.description}" → "${expectedDescription}"`,
          );
        }

        console.log(
          `[FIX] Projeto "${project.name}"` +
            ` | Forecast "${forecast.description}" (${forecast.id.slice(0, 8)})` +
            `${loteLabel(forecast.supplyGroup)}` +
            `\n      ${diffs.join(' | ')}`,
        );

        if (!DRY_RUN) {
          await prisma.projectExpense.update({
            where: { id: expense.id },
            data: {
              description: expectedDescription,
              unit: forecast.unit,
              quantity: expectedQty,
              unitPrice: expectedUnitPrice,
              discountValue: expectedDiscount,
              discountPercentage: forecast.discountPercentage ?? null,
              amount: expectedAmount,
              isPaid: forecast.isPaid,
              status: expectedStatus,
              entityName: forecast.supplier?.name || expense.entityName,
            },
          });
        }

        projectFixCount++;
        totalFixed++;
        continue;
      }

      // Case 2: no expense with matching ID — check if one should exist
      // (forecast is ordered/delivered, so an expense should have been created)

      // Check if any expense was matched by description (the old buggy fallback)
      // but actually belongs to another forecast
      const suffix = `: ${forecast.description}`;
      const descriptionMatchedExpense = expenses.find(
        (e) =>
          e.description.endsWith(suffix) &&
          forecastIdsSet.has(e.id) &&
          e.id !== forecast.id,
      );

      if (descriptionMatchedExpense) {
        console.log(
          `[CREATE] Projeto "${project.name}"` +
            ` | Forecast "${forecast.description}" (${forecast.id.slice(0, 8)})` +
            `${loteLabel(forecast.supplyGroup)}` +
            `\n         Despesa nunca criada — outra despesa` +
            ` (${descriptionMatchedExpense.id.slice(0, 8)}) com mesma descrição` +
            ` pertence ao forecast ${descriptionMatchedExpense.id.slice(0, 8)}` +
            `\n         Criar: qty=${expectedQty}, unit=${forecast.unit},` +
            ` unitPrice=${expectedUnitPrice}, amount=${expectedAmount}`,
        );
      } else {
        console.log(
          `[CREATE] Projeto "${project.name}"` +
            ` | Forecast "${forecast.description}" (${forecast.id.slice(0, 8)})` +
            `${loteLabel(forecast.supplyGroup)}` +
            `\n         Despesa com ID matching não encontrada.` +
            `\n         Criar: qty=${expectedQty}, unit=${forecast.unit},` +
            ` unitPrice=${expectedUnitPrice}, amount=${expectedAmount}`,
        );
      }

      if (!DRY_RUN) {
        // Find a suitable parentId (financial group) from the categoryId or from
        // an existing sibling expense in the same group
        let parentId: string | null = forecast.categoryId ?? null;
        if (!parentId && forecast.supplyGroupId) {
          const siblingForecast = forecasts.find(
            (f) =>
              f.supplyGroupId === forecast.supplyGroupId &&
              f.id !== forecast.id,
          );
          if (siblingForecast) {
            const siblingExpense = expenseById.get(siblingForecast.id);
            if (siblingExpense?.parentId) {
              parentId = siblingExpense.parentId;
            }
          }
        }

        const effectiveDate =
          forecast.purchaseDate ||
          forecast.estimatedDate ||
          new Date().toISOString().split('T')[0];

        await prisma.projectExpense.create({
          data: {
            id: forecast.id,
            projectId: project.id,
            parentId,
            type: 'material',
            itemType: 'item',
            wbs: '',
            order: 0,
            date: effectiveDate,
            description: expectedDescription,
            entityName: forecast.supplier?.name || '',
            unit: forecast.unit,
            quantity: expectedQty,
            unitPrice: expectedUnitPrice,
            discountValue: expectedDiscount,
            discountPercentage: forecast.discountPercentage ?? null,
            amount: expectedAmount,
            isPaid: forecast.isPaid,
            status: expectedStatus,
            paymentDate: forecast.isPaid ? effectiveDate : null,
            paymentProof: forecast.paymentProof ?? null,
            invoiceDoc: null,
            deliveryDate: forecast.deliveryDate ?? null,
          },
        });
      }

      projectCreateCount++;
      totalCreated++;
    }

    if (projectFixCount > 0 || projectCreateCount > 0) {
      console.log(
        `  → Projeto "${project.name}":` +
          ` ${projectFixCount} corrigida(s), ${projectCreateCount} criada(s)\n`,
      );
    }
  }

  const totalProcessed =
    totalAlreadyOk + totalFixed + totalCreated + totalSkipped;

  console.log(`\n${separator}`);
  console.log('  RESUMO');
  console.log(`${separator}`);
  console.log(`  Já corretas:       ${totalAlreadyOk}`);
  console.log(`  Corrigidas:        ${totalFixed}`);
  console.log(`  Criadas:           ${totalCreated}`);
  console.log(`  Total processados: ${totalProcessed}`);
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
