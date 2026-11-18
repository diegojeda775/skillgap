-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "matchScore" INTEGER;

-- AlterTable
ALTER TABLE "TailorRun" ADD COLUMN     "selected" JSONB;
