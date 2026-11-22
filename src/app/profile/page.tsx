import { ArrowRight, Crown, FilePen, FileText } from "lucide-react";
import Link from "next/link";
import { setMasterResume } from "@/app/tailor/actions";
import { DownloadMenu } from "@/components/resumes/DownloadMenu";
import { ReplaceFileForm } from "@/components/resumes/ResumeForms";
import { UploadResumeForm } from "@/components/resumes/UploadResumeForm";
import { MasterNotesForm } from "@/components/tailor/TailorForms";
import { card, secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { resumeLabel } from "@/lib/resume/label";

export default async function ProfilePage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      label: true,
      fileName: true,
      mimeType: true,
      isMaster: true,
      notes: true,
      skills: true,
      sourceResumeId: true,
      updatedAt: true,
      jobs: { select: { id: true, title: true, company: true }, take: 1 },
    },
  });
  const master = resumes.find((r) => r.isMaster);
  const tailored = resumes.filter((r) => r.sourceResumeId);
  const others = resumes.filter((r) => !r.isMaster && !r.sourceResumeId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Your master resume holds everything you&apos;ve done. Every job you add is checked against it, and tailored
          resumes are made from it with its formatting intact.
        </p>
      </div>

      {master ? (
        <section className={`${card} border-violet-200 dark:border-violet-900`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Crown className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">Master resume</p>
                <h2 className="truncate text-lg font-semibold">{resumeLabel(master)}</h2>
                <p className="text-sm text-neutral-500">
                  {master.fileName} · updated {master.updatedAt.toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/resumes/${master.id}`} className={`${secondaryButton} flex items-center gap-1.5`}>
                <FilePen className="size-3.5" aria-hidden /> Edit skills
              </Link>
              <DownloadMenu href={`/resumes/${master.id}/download`} isDocx={master.mimeType === DOCX_MIME} />
            </div>
          </div>

          {master.skills.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills on your master resume">
              {master.skills.map((s) => (
                <li key={s} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  {s}
                </li>
              ))}
            </ul>
          )}

          <details className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-400">
              Upload a newer version
            </summary>
            <div className="mt-3">
              <ReplaceFileForm
                resumeId={master.id}
                prompt="Updated your resume in Word? Upload it here. Jobs will offer to re-check their keywords."
              />
            </div>
          </details>
        </section>
      ) : (
        <section className={`${card} border-dashed`}>
          <h2 className="text-lg font-semibold">Upload your master resume</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Use a Word (.docx) file with all your experience, even if it runs long. Tailored versions trim it down for
            each job and keep its fonts and layout.
          </p>
          <UploadResumeForm />
          {others.some((r) => r.mimeType === DOCX_MIME) && (
            <div className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">Or use one you&apos;ve already uploaded:</p>
              <ul className="space-y-2">
                {others
                  .filter((r) => r.mimeType === DOCX_MIME)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{resumeLabel(r)}</span>
                      <form action={setMasterResume.bind(null, r.id)}>
                        <button className={`${secondaryButton} flex items-center gap-1.5`}>
                          <Crown className="size-3.5" aria-hidden /> Make master
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {master && (
        <section className={card}>
          <h2 className="font-medium">Experience notes</h2>
          <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            True facts that aren&apos;t in the Word file: tools, projects, achievements. Tailored resumes can use them.
            When you confirm a keyword on a job and say where you used it, it&apos;s saved here too.
          </p>
          <MasterNotesForm resumeId={master.id} notes={master.notes} />
        </section>
      )}

      {tailored.length > 0 && (
        <section className={card}>
          <h2 className="mb-3 font-medium">Tailored resumes</h2>
          <ResumeList items={tailored} />
        </section>
      )}

      {others.length > 0 && (
        <details className={card}>
          <summary className="cursor-pointer font-medium">Other uploads ({others.length})</summary>
          <div className="mt-3">
            <ResumeList items={others} />
          </div>
        </details>
      )}
    </div>
  );
}

function ResumeList({
  items,
}: {
  items: { id: string; label: string | null; fileName: string; updatedAt: Date; jobs: { id: string; title: string; company: string | null }[] }[];
}) {
  return (
    <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={r.jobs[0] ? `/jobs/${r.jobs[0].id}` : `/resumes/${r.id}`}
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
          >
            <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{resumeLabel(r)}</span>
              <span className="block text-xs text-neutral-500">Updated {r.updatedAt.toLocaleDateString()}</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-neutral-300" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
