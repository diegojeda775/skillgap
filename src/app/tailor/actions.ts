"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { runTailor, type SelectedKeyword } from "@/lib/tailor/run";

export type TailorFormState = { error: string | null; ok?: boolean };

// Each resume takes up to three paid AI rewrites.
const DAILY_TAILOR_LIMIT = 15;
const MAX_NOTES_CHARS = 20_000;
const MAX_DETAIL_CHARS = 300;

/**
 * Creates a tailored resume for a job from the keywords picked on its page.
 * The form sends `keyword` (analysis item ids) and optional `detail:<id>` fields.
 */
export async function createTailoredResume(jobId: string, _prev: TailorFormState, formData: FormData): Promise<TailorFormState> {
  const user = await requireUser();
  const [job, master] = await Promise.all([
    db.job.findFirst({ where: { id: jobId, userId: user.id } }),
    db.resume.findFirst({ where: { userId: user.id, isMaster: true }, select: { id: true, mimeType: true, notes: true } }),
  ]);
  if (!job) return { error: "Job not found." };
  if (!master || master.mimeType !== DOCX_MIME) return { error: "Upload your master resume (Word .docx) on your Profile first." };

  const analysis = await db.analysis.findFirst({
    where: { id: String(formData.get("analysisId") ?? ""), userId: user.id, jobId, resumeId: master.id, status: "COMPLETE" },
    include: { items: { select: { id: true, name: true, status: true } } },
  });
  if (!analysis) return { error: "Get the keywords and gaps for this job first." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.tailorRun.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (recent >= DAILY_TAILOR_LIMIT) return { error: `You've created ${DAILY_TAILOR_LIMIT} resumes today. Try again tomorrow.` };

  const picked = new Set(formData.getAll("keyword").map(String));
  const selected: SelectedKeyword[] = analysis.items
    .filter((i) => picked.has(i.id))
    .map((i) => ({
      id: i.id,
      name: i.name,
      detail: String(formData.get(`detail:${i.id}`) ?? "").trim().slice(0, MAX_DETAIL_CHARS) || null,
    }));

  // Remember what the user told us on their profile, so future jobs know about it too.
  const known = master.notes.toLowerCase();
  const confirmed = new Set(analysis.items.filter((i) => i.status !== "MATCHED").map((i) => i.id));
  const newNotes = selected
    .filter((k) => k.detail || confirmed.has(k.id))
    .map((k) => (k.detail ? `- ${k.name}: ${k.detail}` : `- ${k.name} (confirmed)`))
    .filter((line) => !known.includes(line.toLowerCase()));
  if (newNotes.length) {
    await db.resume.update({
      where: { id: master.id },
      data: { notes: [master.notes.trim(), ...newNotes].filter(Boolean).join("\n").slice(0, MAX_NOTES_CHARS) },
    });
  }

  const run = await db.tailorRun.create({
    data: {
      userId: user.id,
      jobId: job.id,
      masterResumeId: master.id,
      baselineAnalysisId: analysis.id,
      jobTitle: job.title,
      company: job.company,
      selected: selected as object[],
    },
  });
  after(() => runTailor(run.id));
  // Leaves "change keywords" mode; the page shows progress until the resume is ready.
  redirect(`/jobs/${jobId}`);
}

/** Makes a Word resume the master. There's one master per user. */
export async function setMasterResume(resumeId: string) {
  const user = await requireUser();
  const resume = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, select: { mimeType: true } });
  if (!resume || resume.mimeType !== DOCX_MIME) return;

  await db.$transaction([
    db.resume.updateMany({ where: { userId: user.id, isMaster: true }, data: { isMaster: false } }),
    db.resume.update({ where: { id: resumeId }, data: { isMaster: true, sourceResumeId: null } }),
  ]);
  revalidatePath("/profile");
  revalidatePath(`/resumes/${resumeId}`);
}

export async function saveMasterNotes(resumeId: string, _prev: TailorFormState, formData: FormData): Promise<TailorFormState> {
  const user = await requireUser();
  const notes = String(formData.get("notes") ?? "").replace(/\r\n?/g, "\n").slice(0, MAX_NOTES_CHARS);
  await db.resume.updateMany({ where: { id: resumeId, userId: user.id, isMaster: true }, data: { notes } });
  revalidatePath("/profile");
  return { error: null, ok: true };
}
