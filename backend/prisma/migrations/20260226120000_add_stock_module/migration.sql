-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('ENTRY', 'EXIT');

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "responsible" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockItem_projectId_idx" ON "StockItem"("projectId");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_date_idx" ON "StockMovement"("stockItemId", "date" DESC);

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add stock permissions
INSERT INTO "Permission" ("id", "code", "description")
VALUES
  (gen_random_uuid(), 'stock.view', 'View stock / inventory'),
  (gen_random_uuid(), 'stock.edit', 'Edit stock / inventory')
ON CONFLICT ("code") DO NOTHING;

-- Assign stock permissions to all ADMIN, SUPER_ADMIN and Gestor Principal roles
INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
SELECT gen_random_uuid(), r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."name" IN ('ADMIN', 'SUPER_ADMIN', 'Gestor Principal')
  AND p."code" IN ('stock.view', 'stock.edit')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
