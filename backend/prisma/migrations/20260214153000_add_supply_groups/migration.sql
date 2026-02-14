-- AlterTable
ALTER TABLE "MaterialForecast"
ADD COLUMN "supplyGroupId" TEXT;

-- CreateTable
CREATE TABLE "SupplyGroup" (
  "id" TEXT NOT NULL,
  "title" TEXT,
  "estimatedDate" TEXT NOT NULL,
  "purchaseDate" TEXT,
  "deliveryDate" TEXT,
  "status" TEXT NOT NULL,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "isCleared" BOOLEAN NOT NULL DEFAULT false,
  "supplierId" TEXT,
  "paymentProof" TEXT,
  "invoiceDoc" TEXT,
  "createdById" TEXT,
  "projectPlanningId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialForecast_supplyGroupId_idx" ON "MaterialForecast"("supplyGroupId");

-- AddForeignKey
ALTER TABLE "MaterialForecast"
ADD CONSTRAINT "MaterialForecast_supplyGroupId_fkey"
FOREIGN KEY ("supplyGroupId") REFERENCES "SupplyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyGroup"
ADD CONSTRAINT "SupplyGroup_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyGroup"
ADD CONSTRAINT "SupplyGroup_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyGroup"
ADD CONSTRAINT "SupplyGroup_projectPlanningId_fkey"
FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
