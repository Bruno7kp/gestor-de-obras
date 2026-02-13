-- AlterTable
ALTER TABLE "JournalEntry"
ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
