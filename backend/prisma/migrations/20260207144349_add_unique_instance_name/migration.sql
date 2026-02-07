/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Instance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Instance_name_key" ON "Instance"("name");
