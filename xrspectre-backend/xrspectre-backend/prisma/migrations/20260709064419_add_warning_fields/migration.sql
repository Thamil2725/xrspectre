-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "maxWarnings" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN     "disqualifiedAt" TIMESTAMP(3),
ADD COLUMN     "warningCount" INTEGER NOT NULL DEFAULT 0;
