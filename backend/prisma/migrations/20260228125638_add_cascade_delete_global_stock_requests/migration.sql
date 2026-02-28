-- DropForeignKey
ALTER TABLE "PurchaseRequest" DROP CONSTRAINT "PurchaseRequest_globalStockItemId_fkey";

-- DropForeignKey
ALTER TABLE "StockRequest" DROP CONSTRAINT "StockRequest_globalStockItemId_fkey";

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_globalStockItemId_fkey" FOREIGN KEY ("globalStockItemId") REFERENCES "GlobalStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_globalStockItemId_fkey" FOREIGN KEY ("globalStockItemId") REFERENCES "GlobalStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
