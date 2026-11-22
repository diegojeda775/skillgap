"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { runCoverLetter } from "@/lib/cover-letter/run";
import { letterStatus } from "@/lib/cover-letter/status";
import { db } from "@/lib/db";

export type LetterFormState = { error: string | null; ok?: boolean };

// Each letter takes one or two paid AI calls.
const DAILY_LETTER_LIMIT = 20;
const MIN_AD_CHARS = 200;
const MAX_INSTRUCTIONS_CHARS = 1_000;
const MAX_BODY_CHARS = 10_000;

/** Has the AI write a new version of the job's cover letter. Earlier versions are kept. */
export async function createCoverLetter(jobId: string, _prev: LetterFormState, formData: FormData): Promise<LetterFormState> {
  const user = await requireUser();
  const job = await db.job.findFirst({
    where: { id: jobId, userId: user.id },
    select: {
      id: true,
      resumeId: true,
      description: true,
      coverLetters: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } },
    },
  });
  if (!job) return { error: "Job not found." };
  if (job.description.length < MIN_AD_CHARS) {
    return { error: "The saved job ad is too short. Paste the full description under Details first." };
  }
  if (job.coverLetters[0] && letterStatus(job.coverLetters[0]) === "WRITING") return { error: "A letter is already being written." };

  // The resume going out with this application, or the master if there isn't one yet.
  const resumeId =
    job.resumeId ?? (await db.resume.findFirst({ where: { userId: user.id, isMaster: true }, select: { id: true } }))?.id;
  if (!resumeId) return { error: "Upload your master resume on your Profile first." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.coverLetter.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (recent >= DAILY_LETTER_LIMIT) return { error: `You've created ${DAILY_LETTER_LIMIT} cover letters today. Try again tomorrow.` };

  const instructions = String(formData.get("instructions") ?? "").trim().slice(0, MAX_INSTRUCTIONS_CHARS);
  const letter = await db.coverLetter.create({ data: { userId: user.id, jobId: job.id, resumeId, instructions } });
  after(() => runCoverLetter(letter.id));
  revalidatePath(`/jobs/${jobId}`);
  return { error: null, ok: true };
}

export async function saveCoverLetter(letterId: string, _prev: LetterFormState, formData: FormData): Promise<LetterFormState> {
  const user = await requireUser();
  const body = String(formData.get("body") ?? "").replace(/\r\n?/g, "\n").trim();
  if (!body) return { error: "The letter is empty." };
  if (body.length > MAX_BODY_CHARS) return { error: "That's too long for a cover letter." };

  const letter = await db.coverLetter.findFirst({ where: { id: letterId, userId: user.id, status: "COMPLETE" }, select: { jobId: true } });
  if (!letter) return { error: "Cover letter not found." };
  await db.coverLetter.update({ where: { id: letterId }, data: { body } });
  revalidatePath(`/jobs/${letter.jobId}`);
  return { error: null, ok: true };
}

export async function deleteCoverLetter(letterId: string) {
  const user = await requireUser();
  const letter = await db.coverLetter.findFirst({ where: { id: letterId, userId: user.id }, select: { jobId: true } });
  if (!letter) return;
  await db.coverLetter.delete({ where: { id: letterId } });
  revalidatePath(`/jobs/${letter.jobId}`);
}
