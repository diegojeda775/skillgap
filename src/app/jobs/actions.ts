"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { JobOutcome, JobStage } from "@/generated/prisma/enums";
import { startAnalysis } from "@/lib/analysis/start";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { fetchJobAd } from "@/lib/ingest/job-url";
import { isOutcome, isStage } from "@/lib/jobs/stages";

export type JobFormState = { error: string | null; ok?: boolean };

const POSITION_GAP = 1024;

export async function createJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireUser();
  const url = text(formData, "url");
  let description = text(formData, "description") ?? "";
  let title = text(formData, "title");
  let company = text(formData, "company");
  const stage = isStage(formData.get("stage")) ? (formData.get("stage") as JobStage) : "SAVED";

  if (!url && !description) return { error: "Add a link to the job ad or paste its text." };

  try {
    if (!description && url) {
      const ad = await fetchJobAd(url);
      description = ad.text;
      title ??= ad.title;
      company ??= ad.company;
    }
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }
  if (!title) return { error: "Add the job title." };

  const resumeId = await ownedResumeId(user.id, text(formData, "resumeId"));
  await db.job.create({
    data: {
      userId: user.id,
      title,
      company,
      location: text(formData, "location"),
      url,
      description,
      stage,
      resumeId,
      position: (await topPosition(user.id, stage)) - POSITION_GAP,
      appliedAt: stage === "APPLIED" ? new Date() : null,
      events: { create: { to: stage } },
    },
  });

  revalidatePath("/jobs");
  return { error: null, ok: true };
}

/** Called after a drag and drop. `position` is computed by the board from the card's new neighbors. */
export async function moveJob(jobId: string, stage: JobStage, position: number) {
  const user = await requireUser();
  if (!isStage(stage) || !Number.isFinite(position)) throw new Error("Invalid move");

  const job = await db.job.findFirst({ where: { id: jobId, userId: user.id } });
  if (!job) throw new Error("Job not found");
  await applyMove(job, stage, position);
  // Refreshes the board's stats; the cards already show the move.
  revalidatePath("/jobs");
}

/** Stage picker on the job page: moves the card to the top of the new column. */
export async function changeStage(jobId: string, formData: FormData) {
  const user = await requireUser();
  const stage = formData.get("stage");
  if (!isStage(stage)) return;

  const job = await db.job.findFirst({ where: { id: jobId, userId: user.id } });
  if (!job || job.stage === stage) return;
  await applyMove(job, stage, (await topPosition(user.id, stage)) - POSITION_GAP);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

async function applyMove(
  job: { id: string; stage: JobStage; appliedAt: Date | null; outcome: JobOutcome | null },
  stage: JobStage,
  position: number,
) {
  const stageChanged = job.stage !== stage;
  await db.job.update({
    where: { id: job.id },
    data: {
      stage,
      position,
      ...(stageChanged && {
        stageChangedAt: new Date(),
        outcome: stage === "CLOSED" ? job.outcome : null,
        appliedAt: job.appliedAt ?? (stage === "APPLIED" ? new Date() : null),
        events: { create: { from: job.stage, to: stage } },
      }),
    },
  });
}

export async function setOutcome(jobId: string, outcome: JobOutcome | null) {
  const user = await requireUser();
  if (outcome !== null && !isOutcome(outcome)) return;
  await db.job.updateMany({ where: { id: jobId, userId: user.id }, data: { outcome } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJob(jobId: string, _prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireUser();
  const title = text(formData, "title");
  if (!title) return { error: "The job title can't be empty." };

  const nextActionAt = text(formData, "nextActionAt");
  const description = text(formData, "description");
  await db.job.updateMany({
    where: { id: jobId, userId: user.id },
    data: {
      title,
      company: text(formData, "company"),
      location: text(formData, "location"),
      salary: text(formData, "salary"),
      url: text(formData, "url"),
      notes: text(formData, "notes") ?? "",
      resumeId: await ownedResumeId(user.id, text(formData, "resumeId")),
      nextAction: text(formData, "nextAction"),
      // Date inputs give "YYYY-MM-DD"; store noon UTC so the day doesn't shift across time zones.
      nextActionAt: nextActionAt ? new Date(`${nextActionAt}T12:00:00Z`) : null,
      ...(description && { description }),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { error: null, ok: true };
}

export async function completeNextAction(jobId: string) {
  const user = await requireUser();
  await db.job.updateMany({ where: { id: jobId, userId: user.id }, data: { nextAction: null, nextActionAt: null } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function deleteJob(jobId: string) {
  const user = await requireUser();
  await db.job.deleteMany({ where: { id: jobId, userId: user.id } });
  revalidatePath("/jobs");
  redirect("/jobs");
}

/** "Get skill gaps & keywords" on a job: analyzes the saved ad against a resume version. */
export async function analyzeJob(jobId: string, _prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const user = await requireUser();
  const job = await db.job.findFirst({ where: { id: jobId, userId: user.id } });
  if (!job) return { error: "Job not found." };

  const resumeId = await ownedResumeId(user.id, text(formData, "resumeId"));
  if (!resumeId) return { error: "Pick a resume version, or upload one on the Resumes page." };
  if (job.description.length < 200) return { error: "The saved job ad is too short. Paste the full description in Edit details." };

  let analysisId: string;
  try {
    analysisId = await startAnalysis({
      userId: user.id,
      resumeId,
      jobId: job.id,
      jobText: job.description,
      jobUrl: job.url,
      jobTitle: job.title,
      company: job.company,
    });
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }

  if (!job.resumeId) await db.job.update({ where: { id: job.id }, data: { resumeId } });
  redirect(`/analyses/${analysisId}`);
}

function text(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ownedResumeId(userId: string, resumeId: string | null) {
  if (!resumeId) return null;
  const resume = await db.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } });
  return resume?.id ?? null;
}

async function topPosition(userId: string, stage: JobStage) {
  const first = await db.job.findFirst({
    where: { userId, stage },
    orderBy: { position: "asc" },
    select: { position: true },
  });
  return first?.position ?? POSITION_GAP;
}
