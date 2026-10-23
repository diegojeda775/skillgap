import { ArrowLeft, CalendarClock, Check, ExternalLink, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeNextAction, deleteJob } from "@/app/jobs/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CompanyAvatar } from "@/components/jobs/JobCard";
import { AnalyzeJobForm, JobDetailsForm, OutcomeSelect, StageSelect } from "@/components/jobs/JobForms";
import { card, deleteIconButton, secondaryButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dueState, formatDueDate, toDateInput } from "@/lib/jobs/dates";
import { STAGE_BY_ID } from "@/lib/jobs/stages";
import { resumeLabel } from "@/lib/resume/label";

export default async function JobPage({ params }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const [job, resumes] = await Promise.all([
    db.job.findFirst({
      where: { id, userId: user.id },
      include: {
        events: { orderBy: { createdAt: "desc" } },
        analyses: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            createdAt: true,
            resume: { select: { label: true, fileName: true } },
            items: { select: { status: true, importance: true } },
          },
        },
      },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, label: true, fileName: true },
    }),
  ]);
  if (!job) notFound();

  const resumeOptions = resumes.map((r) => ({ id: r.id, label: resumeLabel(r) }));
  const due = job.nextActionAt && job.stage !== "CLOSED" ? dueState(job.nextActionAt.toISOString()) : null;

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> Board
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <CompanyAvatar name={job.company ?? job.title} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
            {job.company && <span>{job.company}</span>}
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {job.location}
              </span>
            )}
            {job.salary && <span>{job.salary}</span>}
            {job.url && (
              <a href={job.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline underline-offset-2">
                Job ad <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StageSelect jobId={job.id} stage={job.stage} />
          {job.stage === "CLOSED" && <OutcomeSelect jobId={job.id} outcome={job.outcome} />}
          <form action={deleteJob.bind(null, job.id)}>
            <ConfirmButton
              message="Delete this job?"
              confirmLabel="Delete job"
              aria-label="Delete job"
              title="Delete job"
              className={`${deleteIconButton} h-[38px]`}
            >
              <Trash2 className="size-4" aria-hidden />
            </ConfirmButton>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <section className={card}>
            <h2 className="font-medium">Skill gaps & keywords</h2>
            <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Compare the saved job ad with one of your resume versions.
            </p>
            <AnalyzeJobForm jobId={job.id} resumes={resumeOptions} defaultResumeId={job.resumeId} />

            {job.analyses.length > 0 && (
              <ul className="mt-5 divide-y divide-neutral-100 border-t border-neutral-100 dark:divide-neutral-800 dark:border-neutral-800">
                {job.analyses.map((a) => {
                  const required = a.items.filter((i) => i.importance === "REQUIRED");
                  const gaps = a.items.filter((i) => i.status !== "MATCHED").length;
                  const score = required.length
                    ? Math.round(
                        (100 * required.reduce((s, i) => s + (i.status === "MATCHED" ? 1 : i.status === "PARTIAL" ? 0.5 : 0), 0)) /
                          required.length,
                      )
                    : null;
                  return (
                    <li key={a.id}>
                      <Link
                        href={`/analyses/${a.id}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{resumeLabel(a.resume)}</span>
                          <span className="text-neutral-500"> · {a.createdAt.toLocaleDateString()}</span>
                        </span>
                        <span className="shrink-0 text-neutral-600 dark:text-neutral-400">
                          {a.status === "COMPLETE"
                            ? `${score ?? "–"}% match · ${gaps} gaps`
                            : a.status === "FAILED"
                              ? "Failed"
                              : "Running…"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className={card}>
            <details>
              <summary className="cursor-pointer font-medium">Saved job ad</summary>
              <div className="mt-4 max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {job.description}
              </div>
            </details>
          </section>
        </div>

        <aside className="space-y-6">
          {job.nextAction && (
            <section
              className={`${card} ${
                due === "overdue"
                  ? "border-rose-200 dark:border-rose-900"
                  : due === "today"
                    ? "border-amber-200 dark:border-amber-900"
                    : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-neutral-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{job.nextAction}</p>
                  {job.nextActionAt && (
                    <p
                      className={`text-xs ${due === "overdue" ? "text-rose-600 dark:text-rose-400" : due === "today" ? "text-amber-600 dark:text-amber-400" : "text-neutral-500"}`}
                    >
                      {due === "overdue" ? "Overdue · " : due === "today" ? "Due today · " : "Due "}
                      {formatDueDate(job.nextActionAt.toISOString())}
                    </p>
                  )}
                </div>
                <form action={completeNextAction.bind(null, job.id)}>
                  <button className={`${secondaryButton} flex items-center gap-1`}>
                    <Check className="size-3.5" aria-hidden /> Done
                  </button>
                </form>
              </div>
            </section>
          )}

          <section className={card}>
            <h2 className="mb-3 font-medium">Details</h2>
            <JobDetailsForm
              resumes={resumeOptions}
              job={{
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location,
                salary: job.salary,
                url: job.url,
                notes: job.notes,
                resumeId: job.resumeId,
                nextAction: job.nextAction,
                nextActionAt: toDateInput(job.nextActionAt),
              }}
            />
          </section>

          <section className={card}>
            <h2 className="mb-3 font-medium">Timeline</h2>
            <ol className="space-y-3 border-l border-neutral-200 pl-4 dark:border-neutral-800">
              {job.events.map((e) => (
                <li key={e.id} className="relative text-sm">
                  <span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ${STAGE_BY_ID[e.to].dot}`} aria-hidden />
                  <span className="font-medium">{e.from ? `Moved to ${STAGE_BY_ID[e.to].label}` : `Added to ${STAGE_BY_ID[e.to].label}`}</span>
                  <span className="block text-xs text-neutral-500">{e.createdAt.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>

        </aside>
      </div>
    </div>
  );
}
