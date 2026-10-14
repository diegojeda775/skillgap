import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { deleteAnalysis, retryAnalysis } from "@/app/actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CopyButton } from "@/components/CopyButton";
import { card, CATEGORY_LABELS, primaryButton, secondaryButton, STATUS_LABELS, STATUS_STYLES } from "@/components/ui";
import type { AnalysisItem } from "@/generated/prisma/client";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/analysis/providers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

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
      resume: { select: { fileName: true } },
    },
  });
  if (!analysis) notFound();

  const running = analysis.status !== "COMPLETE" && analysis.status !== "FAILED";
  const showKeywords = view === "keywords";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{analysis.jobTitle ?? "Job analysis"}</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {[analysis.company, analysis.resume.fileName, analysis.createdAt.toLocaleString()].filter(Boolean).join(" · ")}
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
          {analysis.status === "COMPLETE" && (
            <form action={retryAnalysis.bind(null, analysis.id)}>
              <ConfirmButton message="Re-run this analysis? It replaces the current results." className={secondaryButton}>
                Re-run
              </ConfirmButton>
            </form>
          )}
          <form action={deleteAnalysis.bind(null, analysis.id)}>
            <ConfirmButton message="Delete this analysis?" className={secondaryButton}>
              Delete
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
          <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
            <Tab href={`/analyses/${id}`} active={!showKeywords}>
              Skill gaps ({analysis.items.filter((i) => i.status !== "MATCHED").length})
            </Tab>
            <Tab href={`/analyses/${id}?view=keywords`} active={showKeywords}>
              All keywords ({analysis.items.length})
            </Tab>
          </div>
          {showKeywords ? <Keywords items={analysis.items} /> : <Gaps items={analysis.items} />}
        </>
      )}

      {analysis.runs.length > 0 && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Models used</summary>
          <ul className="mt-2 space-y-1 font-mono">
            {analysis.runs.map((run) => (
              <li key={run.id}>
                {run.ok ? "✓" : "✗"} {PROVIDER_LABELS[run.provider as ProviderId] ?? run.provider} ({run.model}) ·{" "}
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

function Gaps({ items }: { items: AnalysisItem[] }) {
  const gaps = items
    .filter((i) => i.status !== "MATCHED")
    .sort(
      (a, b) =>
        Number(b.importance === "REQUIRED") - Number(a.importance === "REQUIRED") ||
        Number(b.status === "MISSING") - Number(a.status === "MISSING"),
    );

  if (gaps.length === 0) {
    return <p className="text-sm text-neutral-600 dark:text-neutral-400">No gaps found. Your resume covers everything the ad asks for.</p>;
  }

  return (
    <ul className="space-y-3">
      {gaps.map((item) => (
        <li key={item.id} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <Badge status={item.status} />
            <span className="text-xs text-neutral-500">
              {item.importance === "REQUIRED" ? "Required" : "Preferred"} · {CATEGORY_LABELS[item.category]}
              {item.detail && ` · ${item.detail}`}
            </span>
          </div>
          {item.note && <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{item.note}</p>}
          {item.evidence && (
            <p className="mt-2 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              “{item.evidence}”
            </p>
          )}
          <Agreement item={item} />
        </li>
      ))}
    </ul>
  );
}

function Keywords({ items }: { items: AnalysisItem[] }) {
  const byCategory = Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => ({ label, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 text-xs">
          {(["MATCHED", "PARTIAL", "MISSING"] as const).map((s) => (
            <Badge key={s} status={s} />
          ))}
        </div>
        <CopyButton text={items.map((i) => i.name).join(", ")} label="Copy all keywords" />
      </div>
      {byCategory.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">{group.label}</h3>
          <ul className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <li
                key={item.id}
                title={item.evidence ?? item.note ?? undefined}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset ${STATUS_STYLES[item.status]}`}
              >
                {item.name}
                {item.importance === "PREFERRED" && <span className="opacity-60"> · preferred</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Badge({ status }: { status: AnalysisItem["status"] }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
  );
}

function Agreement({ item }: { item: AnalysisItem }) {
  const names = item.foundBy.map((p) => PROVIDER_LABELS[p as ProviderId] ?? p).join(", ");
  return (
    <p className="mt-2 text-xs text-neutral-400">
      Found by {names}
      {item.agreement < 1 && ` · models agreed ${Math.round(item.agreement * 100)}% on the verdict`}
    </p>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active ? "border-neutral-900 font-medium dark:border-white" : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
