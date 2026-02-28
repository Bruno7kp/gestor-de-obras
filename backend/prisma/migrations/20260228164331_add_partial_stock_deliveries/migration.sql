-- AlterEnum: Add PARTIALLY_DELIVERED and DELIVERED to StockRequestStatus
ALTER TYPE "StockRequestStatus" ADD VALUE 'PARTIALLY_DELIVERED';
ALTER TYPE "StockRequestStatus" ADD VALUE 'DELIVERED';

-- AlterTable: Add quantityDelivered to StockRequest
ALTER TABLE "StockRequest" ADD COLUMN "quantityDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable: Add stockRequestId to PurchaseRequest
ALTER TABLE "PurchaseRequest" ADD COLUMN "stockRequestId" TEXT;

-- CreateTable: StockRequestDelivery
CREATE TABLE "StockRequestDelivery" (
    "id" TEXT NOT NULL,
    "stockRequestId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockRequestDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockRequestDelivery_stockRequestId_idx" ON "StockRequestDelivery"("stockRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_stockRequestId_idx" ON "PurchaseRequest"("stockRequestId");

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestDelivery" ADD CONSTRAINT "StockRequestDelivery_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "StockRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestDelivery" ADD CONSTRAINT "StockRequestDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
