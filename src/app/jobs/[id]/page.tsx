import { AlertTriangle, ArrowLeft, CalendarClock, Check, ExternalLink, FilePen, FileUp, Loader2, MapPin, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { completeNextAction, deleteJob } from "@/app/jobs/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CompanyAvatar } from "@/components/jobs/JobCard";
import { AnalyzeJobButton, JobDetailsForm, OutcomeSelect, StageSelect } from "@/components/jobs/JobForms";
import { DownloadMenu } from "@/components/resumes/DownloadMenu";
import { KeywordPicker, type PickerItem } from "@/components/tailor/KeywordPicker";
import { MatchMeter } from "@/components/tailor/MatchMeter";
import { card, deleteIconButton, primaryButton, secondaryButton } from "@/components/ui";
import type { AnalysisItem } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dueState, formatDueDate, toDateInput } from "@/lib/jobs/dates";
import { STAGE_BY_ID } from "@/lib/jobs/stages";
import { keywordItems, keywordMatch } from "@/lib/tailor/keywords";
import type { SelectedKeyword } from "@/lib/tailor/run";

const TARGET = 85;

export default async function JobPage({ params, searchParams }: PageProps<"/jobs/[id]">) {
  const { id } = await params;
  const { edit } = await searchParams;
  const user = await requireUser();

  const [job, master] = await Promise.all([
    db.job.findFirst({ where: { id, userId: user.id }, include: { events: { orderBy: { createdAt: "desc" } } } }),
    db.resume.findFirst({ where: { userId: user.id, isMaster: true }, select: { id: true, text: true, updatedAt: true } }),
  ]);
  if (!job) notFound();

  const [analysis, run] = master
    ? await Promise.all([
        db.analysis.findFirst({
          where: { jobId: job.id, resumeId: master.id },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        }),
        db.tailorRun.findFirst({
          where: { jobId: job.id },
          orderBy: { createdAt: "desc" },
          include: { result: { select: { id: true, label: true } } },
        }),
      ])
    : [null, null];

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
          <ResumeWorkflow
            jobId={job.id}
            master={master}
            analysis={analysis}
            run={run}
            editing={edit === "1"}
            adLength={job.description.length}
          />

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
                due === "overdue" ? "border-rose-200 dark:border-rose-900" : due === "today" ? "border-amber-200 dark:border-amber-900" : ""
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
              job={{
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location,
                salary: job.salary,
                url: job.url,
                notes: job.notes,
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

interface WorkflowProps {
  jobId: string;
  master: { id: string; text: string; updatedAt: Date } | null;
  analysis: { id: string; status: string; error: string | null; createdAt: Date; items: AnalysisItem[] } | null;
  run: {
    status: string;
    error: string | null;
    rounds: number;
    finalScore: number | null;
    baselineScore: number | null;
    baselineAnalysisId: string | null;
    selected: unknown;
    added: unknown;
    notAdded: unknown;
    result: { id: string; label: string | null } | null;
  } | null;
  editing: boolean;
  adLength: number;
}

/** The main panel: whichever step of keywords → choose → tailored resume the job is at. */
function ResumeWorkflow({ jobId, master, analysis, run, editing, adLength }: WorkflowProps) {
  if (!master) {
    return (
      <Panel step="Get started" title="Upload your master resume">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your master resume is one Word file with all your experience. Every job you add is checked against it, and
          tailored resumes are made from it with its formatting intact.
        </p>
        <Link href="/profile" className={`${primaryButton} mt-4 inline-flex items-center gap-1.5`}>
          <FileUp className="size-4" aria-hidden /> Go to my profile
        </Link>
      </Panel>
    );
  }

  if (run && run.status !== "COMPLETE" && run.status !== "FAILED") {
    return (
      <Panel step="Step 3 of 3" title="Writing your tailored resume">
        <AutoRefresh />
        <Working
          lines={[
            "Rewording your experience in the job ad's terms",
            "Adding the keywords you chose",
            run.rounds > 0 ? `Checking the match (best so far ${run.finalScore}%)` : "Checking the match",
          ]}
        />
        <p className="mt-3 text-xs text-neutral-500">Usually under a minute.</p>
      </Panel>
    );
  }

  if (run?.status === "COMPLETE" && run.result && !editing) {
    const added = (run.added ?? []) as { name: string }[];
    const notAdded = (run.notAdded ?? []) as { name: string }[];
    return (
      <Panel step="Done" title="Your tailored resume">
        <MatchMeter
          score={run.finalScore ?? 0}
          baseline={run.baselineScore ?? undefined}
          baselineLabel="Master resume"
          target={TARGET}
          label="Keyword match"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-sm">
            <span className="font-medium">{run.result.label}</span>
            <span className="block text-neutral-500">Your master&apos;s formatting, rewritten for this job.</span>
          </p>
          <div className="flex gap-2">
            <Link href={`/jobs/${jobId}?edit=1`} className={`${secondaryButton} flex items-center`}>
              Change keywords
            </Link>
            <Link href={`/resumes/${run.result.id}`} className={`${secondaryButton} flex items-center gap-1.5`}>
              <FilePen className="size-3.5" aria-hidden /> Review
            </Link>
            <DownloadMenu resumeId={run.result.id} isDocx />
          </div>
        </div>
        {added.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Added for this job</p>
            <Chips names={added.map((k) => k.name)} tone="green" />
          </div>
        )}
        {notAdded.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Chosen but didn&apos;t fit</p>
            <p className="mb-2 text-xs text-neutral-500">Add these yourself under Review if they belong.</p>
            <Chips names={notAdded.map((k) => k.name)} tone="amber" />
          </div>
        )}
      </Panel>
    );
  }

  if (!analysis) {
    return (
      <Panel step="Step 1 of 3" title="Find the keywords and gaps">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {adLength < 200
            ? "The saved job ad is too short to analyze. Paste the full description under Details first."
            : "AI models read the job ad, list every keyword the employer screens for, and check which ones your master resume shows."}
        </p>
        {adLength >= 200 && <AnalyzeJobButton jobId={jobId} />}
      </Panel>
    );
  }

  if (analysis.status === "FAILED") {
    return (
      <Panel step="Step 1 of 3" title="Find the keywords and gaps">
        <p className="mb-4 flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {analysis.error ?? "The analysis failed."}
        </p>
        <AnalyzeJobButton jobId={jobId} label="Try again" />
      </Panel>
    );
  }

  if (analysis.status !== "COMPLETE") {
    return (
      <Panel step="Step 1 of 3" title="Finding the keywords and gaps">
        <AutoRefresh />
        <Working
          lines={[
            "Reading the job ad",
            "Listing what the employer screens for",
            analysis.status === "COMPARING" ? "Checking your master resume" : "Then checking your master resume",
          ]}
        />
        <p className="mt-3 text-xs text-neutral-500">Usually under a minute.</p>
      </Panel>
    );
  }

  const present = keywordMatch(master.text, keywordItems(analysis.items)).present;
  const items: PickerItem[] = analysis.items.map((i) => ({
    id: i.id,
    name: i.name,
    aliases: i.aliases,
    category: i.category,
    importance: i.importance,
    status: i.status,
    note: i.note,
    evidence: i.evidence,
    present: present.has(i.id),
  }));
  const previous =
    editing && run?.baselineAnalysisId === analysis.id ? ((run.selected ?? []) as SelectedKeyword[]).map((k) => k.id) : undefined;
  const stale = master.updatedAt > analysis.createdAt;

  return (
    <Panel
      step="Step 2 of 3"
      title="Choose the keywords to add"
      aside={
        editing && run?.result ? (
          <Link href={`/jobs/${jobId}`} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            Cancel
          </Link>
        ) : undefined
      }
    >
      {stale && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <RefreshCw className="size-4 shrink-0" aria-hidden /> Your master resume changed since these keywords were checked.
          </span>
          <AnalyzeJobButton jobId={jobId} label="Check again" subtle />
        </div>
      )}
      {run?.status === "FAILED" && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          The last resume couldn&apos;t be created: {run.error ?? "unexpected error"}. Try again below.
        </p>
      )}
      <KeywordPicker
        jobId={jobId}
        analysisId={analysis.id}
        items={items}
        target={TARGET}
        previous={previous}
        submitLabel={run?.result ? "Create new version" : "Create tailored resume"}
      />
    </Panel>
  );
}

function Panel({ step, title, aside, children }: { step: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">{step}</p>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Working({ lines }: { lines: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
      {lines.map((line) => (
        <li key={line} className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-neutral-400" aria-hidden /> {line}
        </li>
      ))}
    </ul>
  );
}

function Chips({ names, tone }: { names: string[]; tone: "green" | "amber" }) {
  const style =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
      : "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {names.map((n) => (
        <li key={n} className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${style}`}>
          {n}
        </li>
      ))}
    </ul>
  );
}
