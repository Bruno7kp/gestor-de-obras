import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

type CountRow = { count: bigint | number };

function toNumber(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definido');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const beforeLegacy = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "WorkItem"
      WHERE "scope" = 'quantitativo'
    `;

    const beforeBlueprint = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "BlueprintItem"
    `;

    const legacyCount = toNumber(beforeLegacy[0]?.count ?? 0);
    const blueprintCount = toNumber(beforeBlueprint[0]?.count ?? 0);

    console.log('Iniciando migração WorkItem(quantitativo) -> BlueprintItem');
    console.log(`Legacy quantitativo antes: ${legacyCount}`);
    console.log(`BlueprintItem antes: ${blueprintCount}`);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        INSERT INTO "BlueprintItem" (
          "id",
          "parentId",
          "name",
          "type",
          "wbs",
          "order",
          "unit",
          "cod",
          "fonte",
          "contractQuantity",
          "unitPrice",
          "unitPriceNoBdi",
          "contractTotal",
          "previousQuantity",
          "previousTotal",
          "currentQuantity",
          "currentTotal",
          "currentPercentage",
          "accumulatedQuantity",
          "accumulatedTotal",
          "accumulatedPercentage",
          "balanceQuantity",
          "balanceTotal",
          "projectId"
        )
        SELECT
          wi."id",
          wi."parentId",
          wi."name",
          wi."type",
          wi."wbs",
          wi."order",
          wi."unit",
          wi."cod",
          wi."fonte",
          wi."contractQuantity",
          wi."unitPrice",
          wi."unitPriceNoBdi",
          wi."contractTotal",
          wi."previousQuantity",
          wi."previousTotal",
          wi."currentQuantity",
          wi."currentTotal",
          wi."currentPercentage",
          wi."accumulatedQuantity",
          wi."accumulatedTotal",
          wi."accumulatedPercentage",
          wi."balanceQuantity",
          wi."balanceTotal",
          wi."projectId"
        FROM "WorkItem" wi
        WHERE wi."scope" = 'quantitativo'
        ON CONFLICT ("id") DO NOTHING
      `);

      await tx.$executeRawUnsafe(`
        UPDATE "ProjectExpense"
        SET "linkedWorkItemId" = NULL
        WHERE "linkedWorkItemId" IN (
          SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
        )
      `);

      await tx.$executeRawUnsafe(`
        DELETE FROM "LaborContractWorkItem"
        WHERE "workItemId" IN (
          SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
        )
      `);

      await tx.$executeRawUnsafe(`
        UPDATE "LaborContract"
        SET "linkedWorkItemId" = NULL
        WHERE "linkedWorkItemId" IN (
          SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
        )
      `);

      await tx.$executeRawUnsafe(`
        DELETE FROM "WorkItemResponsibility"
        WHERE "workItemId" IN (
          SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
        )
      `);

      await tx.$executeRawUnsafe(`
        DELETE FROM "WorkItem"
        WHERE "scope" = 'quantitativo'
      `);

      await tx.$executeRawUnsafe(`
        UPDATE "WorkItem"
        SET "scope" = 'wbs'
        WHERE "scope" IS DISTINCT FROM 'wbs'
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "WorkItem"
        ALTER COLUMN "scope" SET DEFAULT 'wbs'
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "WorkItem"
        ALTER COLUMN "scope" SET NOT NULL
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "WorkItem"
        DROP CONSTRAINT IF EXISTS "WorkItem_scope_wbs_only_chk"
      `);

      await tx.$executeRawUnsafe(`
        ALTER TABLE "WorkItem"
        ADD CONSTRAINT "WorkItem_scope_wbs_only_chk"
        CHECK ("scope" = 'wbs')
      `);
    });

    const afterLegacy = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "WorkItem"
      WHERE "scope" = 'quantitativo'
    `;

    const afterBlueprint = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "BlueprintItem"
    `;

    console.log(`Legacy quantitativo depois: ${toNumber(afterLegacy[0]?.count ?? 0)}`);
    console.log(`BlueprintItem depois: ${toNumber(afterBlueprint[0]?.count ?? 0)}`);
    console.log('Migração concluída com sucesso.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Falha ao migrar dados de quantitativo:', error);
  process.exit(1);
});
