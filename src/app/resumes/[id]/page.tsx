import { ArrowLeft, CheckCircle2, Copy, Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteResume, duplicateResume, saveSkillsSection } from "@/app/resumes/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RenameResumeForm, ReplaceFileForm } from "@/components/resumes/ResumeForms";
import { SkillsSectionEditor } from "@/components/resumes/SkillsSectionEditor";
import { card, deleteIconButton, primaryButton, secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { readSkillsSection } from "@/lib/resume/docx";
import { resumeLabel } from "@/lib/resume/label";
import { parseSkillsFromText } from "@/lib/resume/skills";

export default async function ResumePage({ params, searchParams }: PageProps<"/resumes/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const user = await requireUser();
  const resume = await db.resume.findFirst({
    where: { id, userId: user.id },
    omit: { file: false },
    include: {
      _count: { select: { analyses: true } },
      jobs: { select: { id: true, title: true, company: true }, orderBy: { updatedAt: "desc" }, take: 10 },
    },
  });
  if (!resume) notFound();

  // Resumes uploaded before skills were tracked get them imported on first view.
  let skills = resume.skills;
  if (skills.length === 0) {
    skills = parseSkillsFromText(resume.text);
    if (skills.length) await db.resume.update({ where: { id: resume.id }, data: { skills } });
  }

  const isDocx = resume.file !== null && resume.mimeType === DOCX_MIME;
  const section = isDocx ? await readSkillsSection(Buffer.from(resume.file!)) : null;
  const analyses = resume._count.analyses;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/resumes" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> Resumes
      </Link>

      {created && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          New version created with your original formatting. Download it to send with your application.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{resumeLabel(resume)}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {resume.fileName} · updated {resume.updatedAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {resume.file && (
            <a href={`/resumes/${resume.id}/download`} className={`${primaryButton} flex items-center gap-1.5`}>
              <Download className="size-4" aria-hidden /> Download
            </a>
          )}
          <form action={duplicateResume.bind(null, resume.id)}>
            <button className={`${secondaryButton} flex h-full items-center gap-1.5`}>
              <Copy className="size-3.5" aria-hidden /> Duplicate
            </button>
          </form>
          <form action={deleteResume.bind(null, resume.id)}>
            <ConfirmButton
              message={
                analyses
                  ? `Delete this resume? Its ${analyses} ${analyses === 1 ? "analysis" : "analyses"} will be deleted too.`
                  : "Delete this resume?"
              }
              confirmLabel="Delete resume"
              aria-label="Delete resume"
              title="Delete resume"
              className={`${deleteIconButton} h-full`}
            >
              <Trash2 className="size-4" aria-hidden />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <section className={card}>
        <h2 className="font-medium">Skills section</h2>
        {isDocx && section ? (
          <>
            <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {section.found
                ? "Changes are written into your Word file, keeping its fonts and layout. Only add skills you can back up in an interview."
                : "No Skills section was found in this file. Lines you add here are appended at the end of the resume."}
            </p>
            <SkillsSectionEditor
              key={section.lines.join("\u0000")}
              action={saveSkillsSection.bind(null, resume.id)}
              lines={section.lines}
              originalLines={section.lines}
              submitLabel="Save to resume"
            />
          </>
        ) : (
          <>
            <ul className="mb-4 mt-3 flex flex-wrap gap-2">
              {skills.map((s) => (
                <li key={s} className="rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800">
                  {s}
                </li>
              ))}
              {skills.length === 0 && <li className="text-sm text-neutral-500">No skills section found.</li>}
            </ul>
            <ReplaceFileForm
              resumeId={resume.id}
              prompt={
                resume.mimeType === "application/pdf"
                  ? "PDFs can't be edited without changing their layout. Upload the Word (.docx) version of this resume to edit its skills and keep your formatting."
                  : "Upload the Word (.docx) file of this resume to edit its skills and keep your formatting."
              }
            />
          </>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-medium">Version name</h2>
        <RenameResumeForm resumeId={resume.id} label={resume.label} />
      </section>

      {resume.jobs.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-medium">Used for</h2>
          <ul className="flex flex-wrap gap-2">
            {resume.jobs.map((j) => (
              <li key={j.id}>
                <Link href={`/jobs/${j.id}`} className="rounded-full bg-neutral-100 px-3 py-1 text-sm hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
                  {j.title}
                  {j.company && <span className="text-neutral-500"> · {j.company}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <details>
          <summary className="cursor-pointer font-medium">Resume text (what the AI reads)</summary>
          <pre className="mt-4 max-h-[32rem] overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {resume.text}
          </pre>
        </details>
        {isDocx && (
          <div className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <ReplaceFileForm resumeId={resume.id} prompt="Updated your resume in Word? Upload the new file to replace this version." />
          </div>
        )}
      </section>
    </div>
  );
}
