-- Delete existing project members (dev only)
DELETE FROM "ProjectMember";

-- Drop the old role column and add roleId
ALTER TABLE "ProjectMember" DROP COLUMN "role";
ALTER TABLE "ProjectMember" ADD COLUMN "roleId" TEXT NOT NULL;

-- Add foreign key constraint
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
