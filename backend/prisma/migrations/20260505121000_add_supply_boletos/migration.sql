-- CreateTable
CREATE TABLE "SupplyBoleto" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "dueDate" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdById" TEXT,
    "projectPlanningId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyBoleto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplyBoleto_projectPlanningId_dueDate_idx" ON "SupplyBoleto"("projectPlanningId", "dueDate");

-- AddForeignKey
ALTER TABLE "SupplyBoleto" ADD CONSTRAINT "SupplyBoleto_projectPlanningId_fkey" FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyBoleto" ADD CONSTRAINT "SupplyBoleto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
