import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteResume, duplicateResume } from "@/app/resumes/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ResumeTextForm } from "@/components/resumes/ResumeTextForm";
import { SkillsEditor } from "@/components/resumes/SkillsEditor";
import { card, deleteIconButton, secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumeLabel } from "@/lib/resume/label";

export default async function ResumePage({ params }: PageProps<"/resumes/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const resume = await db.resume.findFirst({
    where: { id, userId: user.id },
    include: {
      _count: { select: { analyses: true } },
      jobs: { select: { id: true, title: true, company: true }, orderBy: { updatedAt: "desc" }, take: 10 },
    },
  });
  if (!resume) notFound();

  const analyses = resume._count.analyses;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/resumes" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> Resumes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{resumeLabel(resume)}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            From {resume.fileName} · updated {resume.updatedAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={duplicateResume.bind(null, resume.id)}>
            <button className={`${secondaryButton} flex items-center gap-1.5`}>
              <Copy className="size-3.5" aria-hidden /> Duplicate as new version
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
        <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Add keywords here from any analysis. Only add skills you can back up in an interview.
        </p>
        <SkillsEditor resumeId={resume.id} skills={resume.skills} />
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
        <h2 className="mb-3 font-medium">Resume text</h2>
        <ResumeTextForm resumeId={resume.id} label={resume.label} text={resume.text} />
      </section>
    </div>
  );
}
