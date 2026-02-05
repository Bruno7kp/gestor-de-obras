-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID', 'DELIVERED');

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "billingCycle" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSettings" (
    "id" TEXT NOT NULL,
    "defaultCompanyName" TEXT NOT NULL,
    "companyCnpj" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCertificate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "globalSettingsId" TEXT NOT NULL,

    CONSTRAINT "CompanyCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGroup" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyCnpj" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "measurementNumber" INTEGER NOT NULL,
    "referenceDate" TEXT NOT NULL,
    "logo" TEXT,
    "bdi" DOUBLE PRECISION NOT NULL,
    "contractTotalOverride" DOUBLE PRECISION,
    "currentTotalOverride" DOUBLE PRECISION,
    "strict" BOOLEAN NOT NULL,
    "printCards" BOOLEAN NOT NULL,
    "printSubtotals" BOOLEAN NOT NULL,
    "showSignatures" BOOLEAN NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PDFTheme" (
    "id" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "primary" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "accentText" TEXT NOT NULL,
    "border" TEXT NOT NULL,
    "currencySymbol" TEXT,
    "headerBg" TEXT NOT NULL,
    "headerText" TEXT NOT NULL,
    "categoryBg" TEXT NOT NULL,
    "categoryText" TEXT NOT NULL,
    "footerBg" TEXT NOT NULL,
    "footerText" TEXT NOT NULL,
    "kpiBg" TEXT NOT NULL,
    "kpiText" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "PDFTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
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

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItemResponsibility" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "workforceMemberId" TEXT NOT NULL,

    CONSTRAINT "WorkItemResponsibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementSnapshot" (
    "id" TEXT NOT NULL,
    "measurementNumber" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "MeasurementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadDate" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExpense" (
    "id" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "wbs" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL,
    "status" "ExpenseStatus" NOT NULL,
    "paymentDate" TEXT,
    "paymentProof" TEXT,
    "invoiceDoc" TEXT,
    "deliveryDate" TEXT,
    "discountValue" DOUBLE PRECISION,
    "discountPercentage" DOUBLE PRECISION,
    "linkedWorkItemId" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPlanning" (
    "id" TEXT NOT NULL,
    "schedule" JSONB,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningTask" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL,
    "dueDate" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "completedAt" TEXT,
    "projectPlanningId" TEXT NOT NULL,

    CONSTRAINT "PlanningTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialForecast" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityNeeded" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "estimatedDate" TEXT NOT NULL,
    "purchaseDate" TEXT,
    "deliveryDate" TEXT,
    "status" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "supplierId" TEXT,
    "paymentProof" TEXT,
    "projectPlanningId" TEXT NOT NULL,

    CONSTRAINT "MaterialForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL,
    "projectPlanningId" TEXT NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectJournal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weatherStatus" TEXT,
    "photoUrls" TEXT[],
    "projectJournalId" TEXT NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiddingProcess" (
    "id" TEXT NOT NULL,
    "tenderNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "openingDate" TEXT NOT NULL,
    "expirationDate" TEXT NOT NULL,
    "estimatedValue" DOUBLE PRECISION NOT NULL,
    "ourProposalValue" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "bdi" DOUBLE PRECISION NOT NULL,
    "itemsSnapshot" JSONB NOT NULL,
    "assetsSnapshot" JSONB NOT NULL,
    "instanceId" TEXT NOT NULL,

    CONSTRAINT "BiddingProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkforceMember" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "empresa_vinculada" TEXT NOT NULL,
    "foto" TEXT,
    "cargo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "WorkforceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataVencimento" TEXT NOT NULL,
    "arquivoUrl" TEXT,
    "status" TEXT NOT NULL,
    "workforceMemberId" TEXT NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_instanceId_key" ON "Subscription"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSettings_instanceId_key" ON "GlobalSettings"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "PDFTheme_projectId_key" ON "PDFTheme"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkItemResponsibility_workItemId_workforceMemberId_key" ON "WorkItemResponsibility"("workItemId", "workforceMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPlanning_projectId_key" ON "ProjectPlanning"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectJournal_projectId_key" ON "ProjectJournal"("projectId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSettings" ADD CONSTRAINT "GlobalSettings_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCertificate" ADD CONSTRAINT "CompanyCertificate_globalSettingsId_fkey" FOREIGN KEY ("globalSettingsId") REFERENCES "GlobalSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PDFTheme" ADD CONSTRAINT "PDFTheme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemResponsibility" ADD CONSTRAINT "WorkItemResponsibility_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItemResponsibility" ADD CONSTRAINT "WorkItemResponsibility_workforceMemberId_fkey" FOREIGN KEY ("workforceMemberId") REFERENCES "WorkforceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementSnapshot" ADD CONSTRAINT "MeasurementSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExpense" ADD CONSTRAINT "ProjectExpense_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlanning" ADD CONSTRAINT "ProjectPlanning_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningTask" ADD CONSTRAINT "PlanningTask_projectPlanningId_fkey" FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialForecast" ADD CONSTRAINT "MaterialForecast_projectPlanningId_fkey" FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialForecast" ADD CONSTRAINT "MaterialForecast_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectPlanningId_fkey" FOREIGN KEY ("projectPlanningId") REFERENCES "ProjectPlanning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectJournal" ADD CONSTRAINT "ProjectJournal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_projectJournalId_fkey" FOREIGN KEY ("projectJournalId") REFERENCES "ProjectJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiddingProcess" ADD CONSTRAINT "BiddingProcess_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkforceMember" ADD CONSTRAINT "WorkforceMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_workforceMemberId_fkey" FOREIGN KEY ("workforceMemberId") REFERENCES "WorkforceMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
