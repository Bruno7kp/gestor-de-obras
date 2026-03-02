-- AlterTable
ALTER TABLE "WorkforceMember" ADD COLUMN     "contractorId" TEXT;

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'PJ',
    "city" TEXT NOT NULL DEFAULT '',
    "specialty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAgency" TEXT NOT NULL DEFAULT '',
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "pixKey" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contractor_instanceId_idx" ON "Contractor"("instanceId");

-- AddForeignKey
ALTER TABLE "WorkforceMember" ADD CONSTRAINT "WorkforceMember_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
