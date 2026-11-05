-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;
