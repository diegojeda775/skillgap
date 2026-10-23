import { FileText } from "lucide-react";
import Link from "next/link";
import { UploadResumeForm } from "@/components/resumes/UploadResumeForm";
import { card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumeLabel } from "@/lib/resume/label";

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      label: true,
      fileName: true,
      skills: true,
      updatedAt: true,
      _count: { select: { jobs: true, analyses: true } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resumes</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Keep a version for each kind of role you apply to. Duplicate one to start a new version.
        </p>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-medium">Upload a version</h2>
        <UploadResumeForm />
      </section>

      {resumes.length === 0 ? (
        <p className="text-sm text-neutral-500">No resumes yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {resumes.map((r) => (
            <li key={r.id}>
              <Link href={`/resumes/${r.id}`} className={`${card} block h-full transition hover:border-neutral-400 dark:hover:border-neutral-600`}>
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800">
                    <FileText className="size-4 text-neutral-500" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{resumeLabel(r)}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {r.fileName} · updated {r.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {r.skills.length ? r.skills.join(" · ") : "No skills listed yet"}
                </p>
                <p className="mt-3 text-xs text-neutral-400">
                  {r.skills.length} skills · {r._count.jobs} jobs · {r._count.analyses} analyses
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
