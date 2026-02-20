-- AlterTable
ALTER TABLE "CompanyCertificate"
ADD COLUMN "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill nulls (safety)
UPDATE "CompanyCertificate"
SET "attachmentUrls" = ARRAY[]::TEXT[]
WHERE "attachmentUrls" IS NULL;

-- Enforce not null default semantics
ALTER TABLE "CompanyCertificate"
ALTER COLUMN "attachmentUrls" SET NOT NULL;
