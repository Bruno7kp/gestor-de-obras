-- AlterTable
ALTER TABLE "CompanyCertificate" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OUTROS',
ALTER COLUMN "expirationDate" DROP NOT NULL;
