import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { runAnalysis } from "./pipeline";

// Each analysis makes several paid AI calls, so cap usage per user.
const DAILY_ANALYSIS_LIMIT = 25;
const MAX_JOB_CHARS = 30_000;

interface StartAnalysisInput {
  userId: string;
  resumeId: string;
  jobText: string;
  jobUrl?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  jobId?: string | null;
}

/**
 * Creates an analysis and runs it after the response is sent. Returns the analysis id.
 * `run` lets callers do follow-up work once the analysis finishes.
 */
export async function startAnalysis(
  input: StartAnalysisInput,
  run: (analysisId: string) => Promise<void> = runAnalysis,
): Promise<string> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.analysis.count({ where: { userId: input.userId, createdAt: { gte: since } } });
  if (recent >= DAILY_ANALYSIS_LIMIT) {
    throw new UserInputError(`You've reached the limit of ${DAILY_ANALYSIS_LIMIT} analyses per day. Try again tomorrow.`);
  }

  const analysis = await db.analysis.create({
    data: { ...input, jobText: input.jobText.slice(0, MAX_JOB_CHARS) },
  });

  // The page showing it polls until the run finishes.
  after(() => run(analysis.id));
  return analysis.id;
}
