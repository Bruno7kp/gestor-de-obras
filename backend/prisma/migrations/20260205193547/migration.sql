-- CreateTable
CREATE TABLE "LaborContract" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "associadoId" TEXT NOT NULL,
    "valorTotal" DOUBLE PRECISION NOT NULL,
    "valorPago" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "dataInicio" TEXT NOT NULL,
    "dataFim" TEXT,
    "linkedWorkItemId" TEXT,
    "observacoes" TEXT,
    "ordem" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "LaborContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborPayment" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "descricao" TEXT NOT NULL,
    "comprovante" TEXT,
    "laborContractId" TEXT NOT NULL,

    CONSTRAINT "LaborPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_associadoId_fkey" FOREIGN KEY ("associadoId") REFERENCES "WorkforceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborContract" ADD CONSTRAINT "LaborContract_linkedWorkItemId_fkey" FOREIGN KEY ("linkedWorkItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborPayment" ADD CONSTRAINT "LaborPayment_laborContractId_fkey" FOREIGN KEY ("laborContractId") REFERENCES "LaborContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
