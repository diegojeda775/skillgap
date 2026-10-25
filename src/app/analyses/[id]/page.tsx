import { ArrowLeft, KanbanSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAnalysis, retryAnalysis, saveAnalysisAsJob } from "@/app/actions";
import { AnalysisResults } from "@/components/analysis/AnalysisResults";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import { card, deleteIconButton, primaryButton, secondaryButton, STATUS_LABELS } from "@/components/ui";
import type { AnalysisItem } from "@/generated/prisma/client";
import { providerLabel } from "@/lib/analysis/provider-labels";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { resumeLabel } from "@/lib/resume/label";
import { hasSkill } from "@/lib/resume/skills";

const STEPS = [
  { status: "EXTRACTING", label: "Reading the job ad" },
  { status: "COMPARING", label: "Checking your resume" },
] as const;

export default async function AnalysisPage({ params, searchParams }: PageProps<"/analyses/[id]">) {
  const { id } = await params;
  const { view } = await searchParams;
  const user = await requireUser();

  const analysis = await db.analysis.findFirst({
    where: { id, userId: user.id },
    include: {
      items: true,
      runs: { orderBy: { createdAt: "asc" } },
      resume: { select: { id: true, fileName: true, label: true, skills: true } },
      job: { select: { id: true, title: true } },
    },
  });
  if (!analysis) notFound();

  const running = analysis.status !== "COMPLETE" && analysis.status !== "FAILED";
  const resumeSkills = analysis.resume.skills;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {analysis.job && (
        <Link href={`/jobs/${analysis.job.id}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
          <ArrowLeft className="size-4" aria-hidden /> {analysis.job.title}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{analysis.jobTitle ?? "Job analysis"}</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {[analysis.company, resumeLabel(analysis.resume), analysis.createdAt.toLocaleString()].filter(Boolean).join(" · ")}
            {analysis.jobUrl && (
              <>
                {" · "}
                <a href={analysis.jobUrl} target="_blank" rel="noreferrer" className="underline">
                  Job ad
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {!analysis.job && (
            <form action={saveAnalysisAsJob.bind(null, analysis.id)}>
              <button className={`${secondaryButton} flex items-center gap-1.5`}>
                <KanbanSquare className="size-3.5" aria-hidden /> Save to job board
              </button>
            </form>
          )}
          {analysis.status === "COMPLETE" && (
            <form action={retryAnalysis.bind(null, analysis.id)}>
              <ConfirmButton message="Re-run this analysis?" confirmLabel="Re-run" destructive={false} className={secondaryButton}>
                Re-run
              </ConfirmButton>
            </form>
          )}
          <form action={deleteAnalysis.bind(null, analysis.id)}>
            <ConfirmButton
              message="Delete this analysis?"
              confirmLabel="Delete analysis"
              aria-label="Delete analysis"
              title="Delete analysis"
              className={`${deleteIconButton} h-full`}
            >
              <Trash2 className="size-4" aria-hidden />
            </ConfirmButton>
          </form>
        </div>
      </div>

      {running && (
        <div className={card}>
          <AutoRefresh />
          <ol className="space-y-2 text-sm">
            {STEPS.map((step, i) => {
              const current = STEPS.findIndex((s) => s.status === analysis.status);
              const state = i < current ? "done" : i === current ? "active" : "waiting";
              return (
                <li key={step.status} className={state === "waiting" ? "text-neutral-400" : ""}>
                  {state === "done" ? "✓" : state === "active" ? "…" : "○"} {step.label}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-neutral-500">This usually takes under a minute.</p>
        </div>
      )}

      {analysis.status === "FAILED" && (
        <div className={card}>
          <p className="text-sm text-rose-700 dark:text-rose-400">{analysis.error ?? "The analysis failed."}</p>
          <form action={retryAnalysis.bind(null, analysis.id)} className="mt-4">
            <button className={primaryButton}>Try again</button>
          </form>
        </div>
      )}

      {analysis.status === "COMPLETE" && (
        <>
          <Summary items={analysis.items} />
          <AnalysisResults
            analysisId={analysis.id}
            initialView={view === "keywords" ? "keywords" : "gaps"}
            resume={{ id: analysis.resume.id, label: resumeLabel(analysis.resume) }}
            items={analysis.items.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              importance: item.importance,
              detail: item.detail,
              status: item.status,
              evidence: item.evidence,
              note: item.note,
              foundBy: item.foundBy,
              agreement: item.agreement,
              inResume: [item.name, ...item.aliases].some((n) => hasSkill(resumeSkills, n)),
            }))}
          />
        </>
      )}

      {analysis.runs.length > 0 && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Models used</summary>
          <ul className="mt-2 space-y-1 font-mono">
            {analysis.runs.map((run) => (
              <li key={run.id}>
                {run.ok ? "✓" : "✗"} {providerLabel(run.provider)} ({run.model}) ·{" "}
                {run.step.toLowerCase()} · {(run.latencyMs / 1000).toFixed(1)}s
                {run.error && <span className="text-rose-600"> · {run.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Summary({ items }: { items: AnalysisItem[] }) {
  const required = items.filter((i) => i.importance === "REQUIRED");
  const count = (status: AnalysisItem["status"]) => required.filter((i) => i.status === status).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      {(["MATCHED", "PARTIAL", "MISSING"] as const).map((status) => (
        <div key={status} className={card}>
          <p className="text-2xl font-semibold">
            {count(status)}
            <span className="text-base font-normal text-neutral-400"> / {required.length}</span>
          </p>
          <p className="text-xs text-neutral-500">Required · {STATUS_LABELS[status].toLowerCase()}</p>
        </div>
      ))}
    </div>
  );
}
