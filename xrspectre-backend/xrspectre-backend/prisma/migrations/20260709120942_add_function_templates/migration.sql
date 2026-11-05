-- AlterTable
ALTER TABLE "PoolQuestion" ADD COLUMN     "functionSignature" JSONB DEFAULT '{}',
ADD COLUMN     "functionTemplates" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "functionSignature" JSONB DEFAULT '{}',
ADD COLUMN     "functionTemplates" JSONB DEFAULT '{}';
