"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { fetchJobAd } from "@/lib/ingest/job-url";
import { resumeToText } from "@/lib/ingest/resume";

// Each analysis makes several paid AI calls, so cap usage per user.
const DAILY_ANALYSIS_LIMIT = 25;
const MAX_JOB_CHARS = 30_000;

export type FormState = { error: string | null };

export async function createAnalysis(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.analysis.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (recent >= DAILY_ANALYSIS_LIMIT) {
    return { error: `You've reached the limit of ${DAILY_ANALYSIS_LIMIT} analyses per day. Try again tomorrow.` };
  }

  const file = formData.get("resume");
  const savedResumeId = String(formData.get("resumeId") ?? "");
  const jobUrl = String(formData.get("jobUrl") ?? "").trim() || null;
  let jobText = String(formData.get("jobText") ?? "").trim();
  let jobTitle: string | null = null;
  let company: string | null = null;

  if (!jobUrl && !jobText) return { error: "Add a link to the job ad or paste its text." };
  if (jobText && jobText.length < 200) return { error: "That job ad looks too short. Paste the full description." };

  let analysisId: string;
  try {
    let resumeId: string;
    if (file instanceof File && file.size > 0) {
      const text = await resumeToText(file);
      resumeId = (await db.resume.create({ data: { userId: user.id, fileName: file.name, text } })).id;
    } else if (savedResumeId) {
      const saved = await db.resume.findFirst({ where: { id: savedResumeId, userId: user.id }, select: { id: true } });
      if (!saved) return { error: "That saved resume no longer exists. Upload it again." };
      resumeId = saved.id;
    } else {
      return { error: "Upload your resume." };
    }

    // Pasted text wins over the link, so users can fix a page that didn't fetch well.
    if (!jobText && jobUrl) {
      const ad = await fetchJobAd(jobUrl);
      ({ text: jobText, title: jobTitle, company } = ad);
    }

    const analysis = await db.analysis.create({
      data: { userId: user.id, resumeId, jobUrl, jobText: jobText.slice(0, MAX_JOB_CHARS), jobTitle, company },
    });
    analysisId = analysis.id;
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }

  // Runs after the response is sent; the results page polls until it finishes.
  after(() => runAnalysis(analysisId));
  redirect(`/analyses/${analysisId}`);
}

export async function retryAnalysis(analysisId: string) {
  const user = await requireUser();
  const { count } = await db.analysis.updateMany({
    // Re-running a finished analysis is useful after prompt or model changes.
    where: { id: analysisId, userId: user.id, status: { in: ["FAILED", "COMPLETE"] } },
    data: { status: "QUEUED", error: null },
  });
  if (count === 0) return;

  after(() => runAnalysis(analysisId));
  revalidatePath(`/analyses/${analysisId}`);
}

export async function deleteAnalysis(analysisId: string) {
  const user = await requireUser();
  await db.analysis.deleteMany({ where: { id: analysisId, userId: user.id } });
  revalidatePath("/analyses");
  redirect("/analyses");
}
