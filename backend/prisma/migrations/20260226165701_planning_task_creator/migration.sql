-- AlterTable
ALTER TABLE "PlanningTask" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "PlanningTask" ADD CONSTRAINT "PlanningTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
