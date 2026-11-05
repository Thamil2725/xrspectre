/*
  Warnings:

  - You are about to drop the column `poolId` on the `Test` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Test" DROP CONSTRAINT "Test_poolId_fkey";

-- AlterTable
ALTER TABLE "Test" DROP COLUMN "poolId",
ALTER COLUMN "maxWarnings" SET DEFAULT 3;

-- AlterTable
ALTER TABLE "TestAttempt" ALTER COLUMN "ipAddress" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "TestPool" (
    "testId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,

    CONSTRAINT "TestPool_pkey" PRIMARY KEY ("testId","poolId")
);

-- AddForeignKey
ALTER TABLE "TestPool" ADD CONSTRAINT "TestPool_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestPool" ADD CONSTRAINT "TestPool_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
