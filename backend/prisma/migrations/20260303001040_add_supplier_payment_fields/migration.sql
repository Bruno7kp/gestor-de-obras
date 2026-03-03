-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "bankAccount" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankAgency" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pixKey" TEXT;
