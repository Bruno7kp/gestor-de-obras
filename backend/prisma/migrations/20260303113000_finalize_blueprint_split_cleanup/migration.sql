-- Backfill remaining legacy quantitative rows (idempotent)
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
ON CONFLICT ("id") DO NOTHING;

-- Clean references that may still point to legacy quantitative rows
UPDATE "ProjectExpense"
SET "linkedWorkItemId" = NULL
WHERE "linkedWorkItemId" IN (
  SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
);

DELETE FROM "LaborContractWorkItem"
WHERE "workItemId" IN (
  SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
);

UPDATE "LaborContract"
SET "linkedWorkItemId" = NULL
WHERE "linkedWorkItemId" IN (
  SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
);

DELETE FROM "WorkItemResponsibility"
WHERE "workItemId" IN (
  SELECT "id" FROM "WorkItem" WHERE "scope" = 'quantitativo'
);

-- Remove legacy quantitative rows from WorkItem
DELETE FROM "WorkItem"
WHERE "scope" = 'quantitativo';

-- Enforce WBS-only scope in legacy table
UPDATE "WorkItem"
SET "scope" = 'wbs'
WHERE "scope" IS DISTINCT FROM 'wbs';

ALTER TABLE "WorkItem"
ALTER COLUMN "scope" SET DEFAULT 'wbs';

ALTER TABLE "WorkItem"
ALTER COLUMN "scope" SET NOT NULL;

ALTER TABLE "WorkItem"
DROP CONSTRAINT IF EXISTS "WorkItem_scope_wbs_only_chk";

ALTER TABLE "WorkItem"
ADD CONSTRAINT "WorkItem_scope_wbs_only_chk"
CHECK ("scope" = 'wbs');
