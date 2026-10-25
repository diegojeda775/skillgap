"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { runAnalysis } from "@/lib/analysis/pipeline";
import { startAnalysis } from "@/lib/analysis/start";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { fetchJobAd } from "@/lib/ingest/job-url";
import { readResumeFile } from "@/lib/ingest/resume";
import { parseSkillsFromText } from "@/lib/resume/skills";

export type FormState = { error: string | null };

export async function createAnalysis(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

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
      const { text, buffer, mimeType } = await readResumeFile(file);
      resumeId = (
        await db.resume.create({
          data: {
            userId: user.id,
            fileName: file.name,
            text,
            skills: parseSkillsFromText(text),
            file: new Uint8Array(buffer),
            mimeType,
          },
        })
      ).id;
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

    analysisId = await startAnalysis({ userId: user.id, resumeId, jobUrl, jobText, jobTitle, company });
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }

  redirect(`/analyses/${analysisId}`);
}

export async function retryAnalysis(analysisId: string) {
  const user = await requireUser();
  const { count } = await db.analysis.updateMany({
    // Re-running a finished analysis is useful after prompt, model or resume changes.
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

/** Saves the job from a quick analysis to the tracker and links them. */
export async function saveAnalysisAsJob(analysisId: string) {
  const user = await requireUser();
  const analysis = await db.analysis.findFirst({ where: { id: analysisId, userId: user.id } });
  if (!analysis) return;
  if (analysis.jobId) redirect(`/jobs/${analysis.jobId}`);

  const first = await db.job.findFirst({
    where: { userId: user.id, stage: "SAVED" },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  const job = await db.job.create({
    data: {
      userId: user.id,
      title: analysis.jobTitle ?? "Untitled role",
      company: analysis.company,
      url: analysis.jobUrl,
      description: analysis.jobText,
      resumeId: analysis.resumeId,
      position: (first?.position ?? 1024) - 1024,
      events: { create: { to: "SAVED" } },
    },
  });
  await db.analysis.update({ where: { id: analysis.id }, data: { jobId: job.id } });
  redirect(`/jobs/${job.id}`);
}
