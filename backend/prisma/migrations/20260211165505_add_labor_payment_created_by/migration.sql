-- This migration was reconstructed to match the applied schema change.

ALTER TABLE "LaborPayment" ADD COLUMN "createdById" TEXT;

ALTER TABLE "LaborPayment"
ADD CONSTRAINT "LaborPayment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
