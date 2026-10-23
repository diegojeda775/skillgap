import type { JobOutcome, JobStage } from "@/generated/prisma/enums";

export interface StageInfo {
  id: JobStage;
  label: string;
  hint: string;
  /** Tailwind classes for the column accent dot and badges. */
  dot: string;
  badge: string;
}

// Outreach comes before Applied on purpose: referrals and hiring-manager contact help most
// before a resume lands in the applicant tracking system.
export const STAGES: StageInfo[] = [
  { id: "SAVED", label: "Saved", hint: "Jobs worth a closer look", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  { id: "OUTREACH", label: "Reaching out", hint: "Referrals and recruiter contact", dot: "bg-violet-500", badge: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  { id: "APPLIED", label: "Applied", hint: "Waiting to hear back", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { id: "INTERVIEWING", label: "Interviewing", hint: "Screens through final rounds", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { id: "OFFER", label: "Offer", hint: "Negotiating or deciding", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { id: "CLOSED", label: "Closed", hint: "Accepted, rejected or dropped", dot: "bg-neutral-400", badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<JobStage, StageInfo>;

export const OUTCOMES: { id: JobOutcome; label: string; badge: string }[] = [
  { id: "ACCEPTED", label: "Accepted", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { id: "REJECTED", label: "Rejected", badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { id: "WITHDREW", label: "Withdrew", badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
  { id: "NO_RESPONSE", label: "No response", badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
];

export const OUTCOME_BY_ID = Object.fromEntries(OUTCOMES.map((o) => [o.id, o])) as Record<JobOutcome, (typeof OUTCOMES)[number]>;

export function isStage(value: unknown): value is JobStage {
  return typeof value === "string" && value in STAGE_BY_ID;
}

export function isOutcome(value: unknown): value is JobOutcome {
  return typeof value === "string" && value in OUTCOME_BY_ID;
}
