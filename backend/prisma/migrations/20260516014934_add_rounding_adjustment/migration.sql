-- AlterTable
ALTER TABLE "MeasurementSnapshot" ADD COLUMN     "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "roundingAdjustment" DOUBLE PRECISION DEFAULT 0;
