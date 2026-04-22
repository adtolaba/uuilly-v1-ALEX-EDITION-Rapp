-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "files" JSONB;
