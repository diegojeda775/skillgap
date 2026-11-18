-- CreateEnum
CREATE TYPE "TailorStatus" AS ENUM ('QUEUED', 'ANALYZING', 'WRITING', 'SCORING', 'COMPLETE', 'FAILED');

-- AlterEnum
ALTER TYPE "PipelineStep" ADD VALUE 'WRITE';

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "isMaster" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sourceResumeId" TEXT;

-- CreateTable
CREATE TABLE "TailorRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "masterResumeId" TEXT NOT NULL,
    "resultResumeId" TEXT,
    "baselineAnalysisId" TEXT,
    "finalAnalysisId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT,
    "status" "TailorStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "targetScore" INTEGER NOT NULL DEFAULT 85,
    "baselineScore" INTEGER,
    "ceilingScore" INTEGER,
    "finalScore" INTEGER,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    "added" JSONB,
    "notAdded" JSONB,
    "gaps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TailorRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TailorRun_userId_createdAt_idx" ON "TailorRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TailorRun_jobId_idx" ON "TailorRun"("jobId");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_sourceResumeId_fkey" FOREIGN KEY ("sourceResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorRun" ADD CONSTRAINT "TailorRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorRun" ADD CONSTRAINT "TailorRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorRun" ADD CONSTRAINT "TailorRun_masterResumeId_fkey" FOREIGN KEY ("masterResumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorRun" ADD CONSTRAINT "TailorRun_resultResumeId_fkey" FOREIGN KEY ("resultResumeId") REFERENCES "Resume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
