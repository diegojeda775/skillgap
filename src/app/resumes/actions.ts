"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserInputError } from "@/lib/errors";
import { resumeToText } from "@/lib/ingest/resume";
import { dedupeSkills, hasSkill, parseSkillsFromText } from "@/lib/resume/skills";

export type ResumeFormState = { error: string | null; ok?: boolean };

const MAX_SKILLS = 150;

export async function uploadResume(_prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const file = formData.get("resume");
  const label = String(formData.get("label") ?? "").trim() || null;
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a resume file." };

  let id: string;
  try {
    const text = await resumeToText(file);
    id = (
      await db.resume.create({
        data: { userId: user.id, label, fileName: file.name, text, skills: parseSkillsFromText(text) },
      })
    ).id;
  } catch (error) {
    if (error instanceof UserInputError) return { error: error.message };
    throw error;
  }
  redirect(`/resumes/${id}`);
}

export async function updateResume(resumeId: string, _prev: ResumeFormState, formData: FormData): Promise<ResumeFormState> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 200) return { error: "The resume text looks too short." };

  await db.resume.updateMany({
    where: { id: resumeId, userId: user.id },
    data: { label: String(formData.get("label") ?? "").trim() || null, text },
  });
  revalidateResume(resumeId);
  return { error: null, ok: true };
}

/** New version for a different kind of role, starting from an existing one. */
export async function duplicateResume(resumeId: string) {
  const user = await requireUser();
  const source = await db.resume.findFirst({ where: { id: resumeId, userId: user.id } });
  if (!source) return;

  const copy = await db.resume.create({
    data: {
      userId: user.id,
      label: `${source.label ?? source.fileName} (copy)`,
      fileName: source.fileName,
      text: source.text,
      skills: source.skills,
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

export async function addSkill(resumeId: string, name: string) {
  const skill = name.trim().slice(0, 60);
  if (!skill) return;
  await editSkills(resumeId, (skills) => (hasSkill(skills, skill) ? skills : [...skills, skill]));
}

export async function removeSkill(resumeId: string, name: string) {
  await editSkills(resumeId, (skills) => skills.filter((s) => s !== name));
}

/** Re-reads the skills section from the resume text and adds anything new. */
export async function importSkillsFromText(resumeId: string) {
  const user = await requireUser();
  const resume = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, select: { text: true } });
  if (!resume) return;
  const parsed = parseSkillsFromText(resume.text);
  await editSkills(resumeId, (skills) => [...skills, ...parsed]);
}

async function editSkills(resumeId: string, edit: (skills: string[]) => string[]) {
  const user = await requireUser();
  const resume = await db.resume.findFirst({ where: { id: resumeId, userId: user.id }, select: { skills: true } });
  if (!resume) throw new Error("Resume not found");

  await db.resume.update({
    where: { id: resumeId },
    data: { skills: dedupeSkills(edit(resume.skills)).slice(0, MAX_SKILLS) },
  });
  revalidateResume(resumeId);
}

function revalidateResume(resumeId: string) {
  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
  revalidatePath("/analyses/[id]", "page");
}
