-- AlterTable
ALTER TABLE "MaterialForecast" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "MaterialForecast" ADD CONSTRAINT "MaterialForecast_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
