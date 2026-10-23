"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, Clock, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { daysSince, dueState, formatDueDate } from "@/lib/jobs/dates";
import { OUTCOME_BY_ID } from "@/lib/jobs/stages";
import type { JobCardData } from "./JobBoard";

export function SortableJobCard({ job }: { job: JobCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-40" : undefined}
      {...attributes}
      {...listeners}
    >
      <JobCard job={job} />
    </div>
  );
}

export function JobCard({ job, overlay }: { job: JobCardData; overlay?: boolean }) {
  const due = job.nextActionAt && job.stage !== "CLOSED" ? dueState(job.nextActionAt) : null;
  const days = daysSince(job.stageChangedAt);

  return (
    <article
      className={`group relative cursor-grab touch-manipulation select-none rounded-lg border bg-white p-3 shadow-sm transition-shadow active:cursor-grabbing dark:bg-neutral-900 ${
        overlay
          ? "rotate-2 border-neutral-300 shadow-xl dark:border-neutral-600"
          : "border-neutral-200 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-neutral-700"
      }`}
    >
      <div className="flex gap-3">
        <CompanyAvatar name={job.company ?? job.title} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {/* Stretched link: the whole card opens the job, while drags still work. */}
            <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0 focus:outline-none" draggable={false}>
              {job.title}
            </Link>
          </h3>
          {job.company && <p className="truncate text-xs text-neutral-500">{job.company}</p>}
        </div>
      </div>

      {(job.location || job.resumeLabel || job.match || job.outcome) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
          {job.match && <MatchPill score={job.match.score} />}
          {job.outcome && (
            <span className={`rounded-full px-2 py-0.5 font-medium ${OUTCOME_BY_ID[job.outcome].badge}`}>
              {OUTCOME_BY_ID[job.outcome].label}
            </span>
          )}
          {job.resumeLabel && (
            <span className="flex max-w-full items-center gap-1 truncate rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              <FileText className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{job.resumeLabel}</span>
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1 truncate text-neutral-500">
              <MapPin className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{job.location}</span>
            </span>
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800">
        {job.nextAction && job.nextActionAt && due ? (
          <span
            className={`flex min-w-0 items-center gap-1 ${
              due === "overdue"
                ? "font-medium text-rose-600 dark:text-rose-400"
                : due === "today"
                  ? "font-medium text-amber-600 dark:text-amber-400"
                  : "text-neutral-500"
            }`}
            title={job.nextAction}
            suppressHydrationWarning
          >
            <CalendarClock className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              {due === "today" ? "Today" : formatDueDate(job.nextActionAt)} · {job.nextAction}
            </span>
          </span>
        ) : (
          <span className="text-neutral-400">No next step</span>
        )}
        <span className="flex shrink-0 items-center gap-1 text-neutral-400" title="Days in this stage" suppressHydrationWarning>
          <Clock className="size-3" aria-hidden />
          {days === 0 ? "today" : `${days}d`}
        </span>
      </div>
    </article>
  );
}

function MatchPill({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
      : score >= 50
        ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900"
        : "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900";
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium tabular-nums ring-1 ring-inset ${tone}`} title="Required skills matched">
      {score}% match
    </span>
  );
}

const AVATAR_COLORS = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

export function CompanyAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "lg" }) {
  const hash = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-md font-semibold ${AVATAR_COLORS[hash % AVATAR_COLORS.length]} ${
        size === "lg" ? "size-12 text-lg" : "size-8 text-sm"
      }`}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
