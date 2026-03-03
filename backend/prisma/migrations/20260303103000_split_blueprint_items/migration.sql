-- CreateTable
CREATE TABLE "BlueprintItem" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "wbs" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "cod" TEXT,
    "fonte" TEXT,
    "contractQuantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unitPriceNoBdi" DOUBLE PRECISION NOT NULL,
    "contractTotal" DOUBLE PRECISION NOT NULL,
    "previousQuantity" DOUBLE PRECISION NOT NULL,
    "previousTotal" DOUBLE PRECISION NOT NULL,
    "currentQuantity" DOUBLE PRECISION NOT NULL,
    "currentTotal" DOUBLE PRECISION NOT NULL,
    "currentPercentage" DOUBLE PRECISION NOT NULL,
    "accumulatedQuantity" DOUBLE PRECISION NOT NULL,
    "accumulatedTotal" DOUBLE PRECISION NOT NULL,
    "accumulatedPercentage" DOUBLE PRECISION NOT NULL,
    "balanceQuantity" DOUBLE PRECISION NOT NULL,
    "balanceTotal" DOUBLE PRECISION NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "BlueprintItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlueprintItem_projectId_order_idx" ON "BlueprintItem"("projectId", "order");

-- CreateIndex
CREATE INDEX "BlueprintItem_projectId_wbs_idx" ON "BlueprintItem"("projectId", "wbs");

-- AddForeignKey
ALTER TABLE "BlueprintItem" ADD CONSTRAINT "BlueprintItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintItem" ADD CONSTRAINT "BlueprintItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BlueprintItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill Quantitativo data from WorkItem to BlueprintItem
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
WHERE wi."scope" = 'quantitativo';
