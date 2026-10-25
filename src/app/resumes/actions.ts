"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { DOCX_MIME, readResumeFile, resumeText } from "@/lib/ingest/resume";
import { writeSkillsSection } from "@/lib/resume/docx";
import { parseSkillsFromText } from "@/lib/resume/skills";

export type ResumeFormState = { error: string | null; ok?: boolean };

const MAX_NAME_CHARS = 120;

export async function uploadResume(_prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const file = formData.get("resume");
  const label = String(formData.get("label") ?? "").trim().slice(0, MAX_NAME_CHARS) || null;
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a resume file." };

  let id: string;
  try {
    const { text, buffer, mimeType } = await readResumeFile(file);
    id = (
      await db.resume.create({
        data: {
          userId: user.id,
          label,
          fileName: file.name,
          text,
          skills: parseSkillsFromText(text),
          file: new Uint8Array(buffer),
          mimeType,
        },
      })
    ).id;
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }
  redirect(`/resumes/${id}`);
}

/** Swaps in a new file for a version (e.g. the DOCX of a resume first uploaded as PDF). */
export async function replaceResumeFile(resumeId: string, _prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };

  try {
    const { text, buffer, mimeType } = await readResumeFile(file);
    await db.resume.updateMany({
      where: { id: resumeId, userId: user.id },
      data: { fileName: file.name, text, skills: parseSkillsFromText(text), file: new Uint8Array(buffer), mimeType },
    });
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }
  revalidateResume(resumeId);
  return { error: null, ok: true };
}

export async function renameResume(resumeId: string, _prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const label = String(formData.get("label") ?? "").trim().slice(0, MAX_NAME_CHARS) || null;
  await db.resume.updateMany({ where: { id: resumeId, userId: user.id }, data: { label } });
  revalidateResume(resumeId);
  return { error: null, ok: true };
}

/** Saves edits to a version's Skills section, rewriting only that text in the DOCX. */
export async function saveSkillsSection(resumeId: string, _prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const resume = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, omit: { file: false } });
  if (!resume?.file || resume.mimeType !== DOCX_MIME) return { error: "Only Word (.docx) resumes can be edited." };

  const edited = await editDocx(Buffer.from(resume.file), lines(formData));
  await db.resume.update({ where: { id: resumeId }, data: edited });
  revalidateResume(resumeId);
  return { error: null, ok: true };
}

/** Creates a new version from the analysis's resume with an edited Skills section. */
export async function createTailoredResume(analysisId: string, _prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const analysis = await db.analysis.findFirst({
    where: { id: analysisId, userId: user.id },
    select: { jobId: true, resume: { omit: { file: false } } },
  });
  const source = analysis?.resume;
  if (!analysis || !source?.file || source.mimeType !== DOCX_MIME) {
    return { error: "Only Word (.docx) resumes can be tailored." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME_CHARS);
  if (!name) return { error: "Give the new version a name." };

  const edited = await editDocx(Buffer.from(source.file), lines(formData));
  const created = await db.resume.create({
    data: { userId: user.id, label: name, fileName: `${fileSafe(name)}.docx`, mimeType: DOCX_MIME, ...edited },
  });
  // The tailored version is the one to send for this job.
  if (analysis.jobId) await db.job.update({ where: { id: analysis.jobId }, data: { resumeId: created.id } });

  revalidatePath("/resumes");
  redirect(`/resumes/${created.id}?created=1`);
}

export async function duplicateResume(resumeId: string) {
  const user = await requireUser();
  const source = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, omit: { file: false } });
  if (!source) return;

  const copy = await db.resume.create({
    data: {
      userId: user.id,
      label: `${source.label ?? source.fileName} (copy)`,
      fileName: source.fileName,
      text: source.text,
      skills: source.skills,
      file: source.file,
      mimeType: source.mimeType,
    },
  });
  revalidatePath("/resumes");
  redirect(`/resumes/${copy.id}`);
}

export async function deleteResume(resumeId: string) {
  const user = await requireUser();
  await db.resume.deleteMany({ where: { id: resumeId, userId: user.id } });
  revalidatePath("/resumes");
  redirect("/resumes");
}

async function editDocx(docx: Buffer, sectionLines: string[]) {
  const file = await writeSkillsSection(docx, sectionLines);
  const text = await resumeText(file, DOCX_MIME);
  return { file: new Uint8Array(file), text, skills: parseSkillsFromText(text) };
}

/** Skills section lines from the editor; browsers submit textarea line breaks as \r\n. */
function lines(formData: FormData) {
  return formData.getAll("line").map((l) => String(l).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, ""));
}

function fileSafe(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Resume";
}

function revalidateResume(resumeId: string) {
  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
  revalidatePath("/analyses/[id]", "page");
}
