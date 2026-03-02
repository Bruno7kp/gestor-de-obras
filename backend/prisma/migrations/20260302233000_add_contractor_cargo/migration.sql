-- Add cargo to contractors (used only for Autônomo)
ALTER TABLE "Contractor"
ADD COLUMN "cargo" TEXT;