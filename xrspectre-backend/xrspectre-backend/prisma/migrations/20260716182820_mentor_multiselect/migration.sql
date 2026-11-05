/*
  Warnings:

  - You are about to drop the column `batchId` on the `Mentor` table. All the data in the column will be lost.
  - You are about to drop the column `departmentId` on the `Mentor` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Mentor" DROP CONSTRAINT "Mentor_batchId_fkey";

-- DropForeignKey
ALTER TABLE "Mentor" DROP CONSTRAINT "Mentor_departmentId_fkey";

-- DropIndex
DROP INDEX "Mentor_batchId_idx";

-- DropIndex
DROP INDEX "Mentor_departmentId_idx";

-- AlterTable
ALTER TABLE "Mentor" DROP COLUMN "batchId",
DROP COLUMN "departmentId";

-- CreateTable
CREATE TABLE "_DepartmentToMentor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DepartmentToMentor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_BatchToMentor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BatchToMentor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DepartmentToMentor_B_index" ON "_DepartmentToMentor"("B");

-- CreateIndex
CREATE INDEX "_BatchToMentor_B_index" ON "_BatchToMentor"("B");

-- AddForeignKey
ALTER TABLE "_DepartmentToMentor" ADD CONSTRAINT "_DepartmentToMentor_A_fkey" FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DepartmentToMentor" ADD CONSTRAINT "_DepartmentToMentor_B_fkey" FOREIGN KEY ("B") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchToMentor" ADD CONSTRAINT "_BatchToMentor_A_fkey" FOREIGN KEY ("A") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BatchToMentor" ADD CONSTRAINT "_BatchToMentor_B_fkey" FOREIGN KEY ("B") REFERENCES "Mentor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
