import { ArrowLeft, FileWarning } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createTailoredResume } from "@/app/resumes/actions";
import { SkillsSectionEditor } from "@/components/resumes/SkillsSectionEditor";
import { card, primaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { readSkillsSection } from "@/lib/resume/docx";
import { resumeLabel } from "@/lib/resume/label";
import { addSkillsToLines } from "@/lib/resume/skills";

export default async function TailorPage({ params, searchParams }: PageProps<"/analyses/[id]/tailor">) {
  const { id } = await params;
  const { add } = await searchParams;
  const user = await requireUser();

  const analysis = await db.analysis.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      jobTitle: true,
      company: true,
      items: { select: { name: true, category: true } },
      resume: { omit: { file: false } },
    },
  });
  if (!analysis) notFound();
  const { resume } = analysis;

  // Only keywords that came from this analysis, in the order they were picked.
  const requested = (Array.isArray(add) ? add : add ? [add] : []).map((a) => a.trim());
  const keywords = requested
    .map((name) => analysis.items.find((i) => i.name === name))
    .filter((i) => i !== undefined)
    .map((i) => ({ name: i.name, soft: i.category === "SOFT_SKILL" }));

  const back = (
    <Link href={`/analyses/${analysis.id}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
      <ArrowLeft className="size-4" aria-hidden /> Back to results
    </Link>
  );

  if (!resume.file || resume.mimeType !== DOCX_MIME) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {back}
        <div className={`${card} flex gap-4`}>
          <FileWarning className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
          <div className="space-y-3">
            <h1 className="font-medium">This resume needs its Word file</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              To add skills while keeping your resume&apos;s exact formatting, SkillGap edits the original Word (.docx)
              file.{" "}
              {resume.mimeType === "application/pdf"
                ? "PDFs can't be edited without changing their layout."
                : "This version was uploaded before files were saved."}{" "}
              Upload the .docx on the resume page, then come back here.
            </p>
            <Link href={`/resumes/${resume.id}`} className={`${primaryButton} inline-block`}>
              Open {resumeLabel(resume)}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const section = await readSkillsSection(Buffer.from(resume.file));
  const { lines } = addSkillsToLines(section.lines, keywords);
  const name = analysis.jobTitle ?? `${resumeLabel(resume)} (tailored)`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {back}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tailor your resume</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Creates a new version of <strong>{resumeLabel(resume)}</strong> with this Skills section. Everything else in
          the file, including fonts, layout and bold labels, stays exactly the same.
        </p>
      </div>
      <section className={card}>
        {!section.found && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            No Skills section was found in this resume, so these lines will be added at the end. You may want to add a
            Skills heading in Word first.
          </p>
        )}
        <SkillsSectionEditor
          action={createTailoredResume.bind(null, analysis.id)}
          name={name}
          lines={lines}
          originalLines={section.lines}
          added={keywords.map((k) => k.name)}
          submitLabel="Create resume version"
        />
      </section>
    </div>
  );
}
