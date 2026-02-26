-- DropForeignKey
ALTER TABLE "SupplyGroup" DROP CONSTRAINT "SupplyGroup_projectPlanningId_fkey";

-- AlterTable
ALTER TABLE "NotificationDelivery" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationPreference" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "responsible" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SupplyGroup" ADD CONSTRAINT "SupplyGroup_projectPlanningId_fkey" FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
