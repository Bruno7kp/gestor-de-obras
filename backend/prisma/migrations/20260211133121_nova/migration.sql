-- CreateTable
CREATE TABLE "LaborContractWorkItem" (
    "id" TEXT NOT NULL,
    "laborContractId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,

    CONSTRAINT "LaborContractWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaborContractWorkItem_laborContractId_workItemId_key" ON "LaborContractWorkItem"("laborContractId", "workItemId");

-- AddForeignKey
ALTER TABLE "LaborContractWorkItem" ADD CONSTRAINT "LaborContractWorkItem_laborContractId_fkey" FOREIGN KEY ("laborContractId") REFERENCES "LaborContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborContractWorkItem" ADD CONSTRAINT "LaborContractWorkItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
