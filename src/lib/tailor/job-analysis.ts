import "server-only";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { startAnalysis } from "@/lib/analysis/start";
import { db } from "@/lib/db";
import { keywordItems, keywordMatch } from "./keywords";

interface JobForAnalysis {
  id: string;
  userId: string;
  title: string;
  company: string | null;
  url: string | null;
  description: string;
}

/** Starts the keywords-and-gaps analysis of a job against the master resume. Returns the analysis id. */
export function startJobAnalysis(job: JobForAnalysis, masterResumeId: string) {
  return startAnalysis(
    {
      userId: job.userId,
      resumeId: masterResumeId,
      jobId: job.id,
      jobText: job.description,
      jobUrl: job.url,
      jobTitle: job.title,
      company: job.company,
    },
    analyzeAndScore,
  );
}

/** Runs the analysis, then records the master's keyword match on the job for the board. */
async function analyzeAndScore(analysisId: string) {
  await runAnalysis(analysisId);
  const analysis = await db.analysis.findUnique({
    where: { id: analysisId },
    include: { items: true, resume: { select: { text: true } } },
  });
  if (analysis?.status !== "COMPLETE" || !analysis.jobId) return;

  // A tailored resume's score is the one that matters once it exists.
  const tailored = await db.tailorRun.count({ where: { jobId: analysis.jobId, status: "COMPLETE" } });
  if (tailored > 0) return;
  const { score } = keywordMatch(analysis.resume.text, keywordItems(analysis.items));
  await db.job.updateMany({ where: { id: analysis.jobId }, data: { matchScore: score } });
}
