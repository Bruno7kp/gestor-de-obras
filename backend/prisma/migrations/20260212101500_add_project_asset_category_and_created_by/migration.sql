-- AlterTable
ALTER TABLE "ProjectAsset" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'DOCUMENTO_DIVERSO',
ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectAsset" ADD CONSTRAINT "ProjectAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
