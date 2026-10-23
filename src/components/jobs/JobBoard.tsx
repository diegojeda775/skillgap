"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { moveJob, setOutcome } from "@/app/jobs/actions";
import type { JobOutcome, JobStage } from "@/generated/prisma/enums";
import { dueState } from "@/lib/jobs/dates";
import { isStage, OUTCOMES, STAGES } from "@/lib/jobs/stages";
import { primaryButton } from "../ui";
import { AddJobDialog } from "./AddJobDialog";
import { Dialog } from "../Dialog";
import { JobCard, SortableJobCard } from "./JobCard";

export interface JobCardData {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  stage: JobStage;
  position: number;
  outcome: JobOutcome | null;
  nextAction: string | null;
  nextActionAt: string | null;
  stageChangedAt: string;
  resumeLabel: string | null;
  match: { score: number } | null;
}

type Columns = Record<JobStage, JobCardData[]>;

interface Props {
  jobs: JobCardData[];
  resumes: { id: string; label: string }[];
  stats: { applied: number; interviews: number; offers: number };
}

export function JobBoard({ jobs, resumes, stats }: Props) {
  const [columns, setColumns] = useState(() => groupByStage(jobs));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addToStage, setAddToStage] = useState<JobStage | null>(null);
  const [closing, setClosing] = useState<JobCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const beforeDrag = useRef<Columns | null>(null);
  // Stable id so dnd-kit's accessibility ids match between server and client render.
  const dndId = useId();

  // Server data changes (new job, edits elsewhere) replace local state.
  const [prevJobs, setPrevJobs] = useState(jobs);
  if (jobs !== prevJobs) {
    setPrevJobs(jobs);
    setColumns(groupByStage(jobs));
  }

  const sensors = useSensors(
    // A small distance lets a plain click open the card instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageOf = (id: string, cols = columns): JobStage | null =>
    isStage(id) ? id : (STAGES.find((s) => cols[s.id].some((j) => j.id === id))?.id ?? null);

  const activeJob = activeId ? Object.values(columns).flat().find((j) => j.id === activeId) : null;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setError(null);
    beforeDrag.current = columns;
  }

  // Moves the card into the hovered column while dragging, so the column makes room for it.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = stageOf(String(active.id));
    const to = stageOf(String(over.id));
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const job = prev[from].find((j) => j.id === active.id);
      if (!job) return prev;
      const overIndex = prev[to].findIndex((j) => j.id === over.id);
      const index = overIndex >= 0 ? overIndex : prev[to].length;
      return {
        ...prev,
        [from]: prev[from].filter((j) => j.id !== active.id),
        [to]: [...prev[to].slice(0, index), { ...job, stage: to }, ...prev[to].slice(index)],
      };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const original = beforeDrag.current;
    beforeDrag.current = null;
    if (!original) return;
    if (!over) return setColumns(original);

    const id = String(active.id);
    const stage = stageOf(id);
    if (!stage) return setColumns(original);

    let items = columns[stage];
    const oldIndex = items.findIndex((j) => j.id === id);
    const overIndex = items.findIndex((j) => j.id === over.id);
    if (overIndex >= 0 && overIndex !== oldIndex) items = arrayMove(items, oldIndex, overIndex);

    const index = items.findIndex((j) => j.id === id);
    const originalStage = stageOf(id, original)!;
    const originalIndex = original[originalStage].findIndex((j) => j.id === id);
    if (originalStage === stage && originalIndex === index) return setColumns(original);

    const position = between(items[index - 1]?.position, items[index + 1]?.position);
    const stageChanged = originalStage !== stage;
    const moved = {
      ...items[index],
      stage,
      position,
      ...(stageChanged && {
        stageChangedAt: new Date().toISOString(),
        outcome: stage === "CLOSED" ? items[index].outcome : null,
      }),
    };
    setColumns({ ...columns, [stage]: items.map((j) => (j.id === id ? moved : j)) });

    startTransition(async () => {
      try {
        await moveJob(id, stage, position);
      } catch {
        setColumns(original);
        setError("Couldn't move that job. Check your connection and try again.");
      }
    });

    if (stage === "CLOSED" && stageChanged) setClosing(moved);
  }

  function chooseOutcome(outcome: JobOutcome) {
    if (!closing) return;
    const id = closing.id;
    setColumns((prev) => ({ ...prev, CLOSED: prev.CLOSED.map((j) => (j.id === id ? { ...j, outcome } : j)) }));
    setClosing(null);
    startTransition(() => setOutcome(id, outcome));
  }

  const active = jobs.filter((j) => j.stage !== "CLOSED").length;
  const due = jobs.filter((j) => j.stage !== "CLOSED" && j.nextActionAt && dueState(j.nextActionAt) !== "upcoming").length;
  const interviewRate = stats.applied ? Math.round((100 * stats.interviews) / stats.applied) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job search</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Drag cards as your applications move forward. Open a card to run a skill gap analysis.
          </p>
        </div>
        <button className={`${primaryButton} flex items-center gap-1.5`} onClick={() => setAddToStage("SAVED")}>
          <Plus className="size-4" aria-hidden /> Add job
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active applications" value={active} />
        <Stat
          label="Applied → interview"
          value={interviewRate === null ? "–" : `${interviewRate}%`}
          hint={stats.applied ? `${stats.interviews} of ${stats.applied} applied` : "No applications yet"}
        />
        <Stat label="Offers" value={stats.offers} />
        <Stat label="Follow-ups due" value={due} tone={due > 0 ? "warn" : undefined} />
      </dl>

      {error && (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {error}
        </p>
      )}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          if (beforeDrag.current) setColumns(beforeDrag.current);
          beforeDrag.current = null;
          setActiveId(null);
        }}
      >
        {/* On large screens the board breaks out of the page width so all six columns fit. */}
        <div className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 lg:mx-[calc(50%-50vw)] lg:scroll-px-8 lg:px-8">
          {STAGES.map((stage) => (
            <Column key={stage.id} stage={stage} jobs={columns[stage.id]} onAdd={() => setAddToStage(stage.id)} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {activeJob && <JobCard job={activeJob} overlay />}
        </DragOverlay>
      </DndContext>

      <AddJobDialog
        open={addToStage !== null}
        stage={addToStage ?? "SAVED"}
        resumes={resumes}
        onClose={() => setAddToStage(null)}
      />

      <Dialog open={closing !== null} onClose={() => setClosing(null)} title="How did it end?">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Recording outcomes keeps your stats honest. You can change it later on the job page.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.id}
              onClick={() => chooseOutcome(o.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset ring-black/5 transition hover:brightness-95 dark:ring-white/10 ${o.badge}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button onClick={() => setClosing(null)} className="mt-3 w-full text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
          Skip for now
        </button>
      </Dialog>
    </div>
  );
}

function Column({ stage, jobs, onAdd }: { stage: (typeof STAGES)[number]; jobs: JobCardData[]; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section className="flex w-72 shrink-0 snap-start flex-col lg:w-auto lg:min-w-60 lg:max-w-80 lg:flex-1" aria-label={stage.label}>
      <header className="mb-2 flex items-center gap-2 px-1">
        <span className={`size-2 rounded-full ${stage.dot}`} aria-hidden />
        <h2 className="text-sm font-semibold">{stage.label}</h2>
        <span className="rounded-full bg-neutral-200/70 px-1.5 text-xs tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {jobs.length}
        </span>
        <button
          onClick={onAdd}
          className="ml-auto rounded p-1 text-neutral-400 hover:bg-neutral-200/70 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          aria-label={`Add job to ${stage.label}`}
        >
          <Plus className="size-4" />
        </button>
      </header>
      <p className="mb-2 px-1 text-xs text-neutral-500">{stage.hint}</p>
      <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-40 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors ${
            isOver ? "bg-neutral-200/70 dark:bg-neutral-800/80" : "bg-neutral-100/80 dark:bg-neutral-900/60"
          }`}
        >
          {jobs.map((job) => (
            <SortableJobCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <p className="m-auto px-4 py-6 text-center text-xs text-neutral-400">Drop a job here</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>
        {value}
      </dd>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function groupByStage(jobs: JobCardData[]): Columns {
  const columns = Object.fromEntries(STAGES.map((s) => [s.id, [] as JobCardData[]])) as Columns;
  for (const job of [...jobs].sort((a, b) => a.position - b.position)) columns[job.stage].push(job);
  return columns;
}

/** Position for a card dropped between two neighbors (either may be missing). */
function between(prev: number | undefined, next: number | undefined) {
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + 1024;
  if (next !== undefined) return next - 1024;
  return 0;
}
