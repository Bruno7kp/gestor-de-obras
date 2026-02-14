-- AlterTable
ALTER TABLE "MaterialForecast"
ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
