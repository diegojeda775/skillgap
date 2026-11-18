"use client";

import { Sparkles } from "lucide-react";
import { type ReactNode, useActionState } from "react";
import { analyzeJob, changeStage, type JobFormState, setOutcome, updateJob } from "@/app/jobs/actions";
import type { JobOutcome, JobStage } from "@/generated/prisma/enums";
import { OUTCOMES, STAGES } from "@/lib/jobs/stages";
import { input, primaryButton, secondaryButton } from "../ui";

export function StageSelect({ jobId, stage }: { jobId: string; stage: JobStage }) {
  return (
    <form action={changeStage.bind(null, jobId)}>
      <label className="sr-only" htmlFor="stage">
        Stage
      </label>
      <select
        id="stage"
        name="stage"
        defaultValue={stage}
        key={stage}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${input} w-auto min-w-40 font-medium`}
      >
        {STAGES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </form>
  );
}

export function OutcomeSelect({ jobId, outcome }: { jobId: string; outcome: JobOutcome | null }) {
  return (
    <select
      aria-label="Outcome"
      defaultValue={outcome ?? ""}
      onChange={(e) => setOutcome(jobId, (e.target.value || null) as JobOutcome | null)}
      className={`${input} w-auto min-w-40`}
    >
      <option value="">Outcome…</option>
      {OUTCOMES.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Starts (or refreshes) the keywords-and-gaps analysis of the job against the master resume. */
export function AnalyzeJobButton({ jobId, label = "Get keywords & gaps", subtle }: { jobId: string; label?: string; subtle?: boolean }) {
  const [state, formAction, pending] = useActionState<JobFormState, FormData>(() => analyzeJob(jobId), { error: null });
  return (
    <form action={formAction} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className={subtle ? `${secondaryButton} flex items-center gap-1.5` : `${primaryButton} flex items-center gap-1.5`}
      >
        <Sparkles className="size-4" aria-hidden />
        {pending ? "Starting…" : label}
      </button>
      {state.error && <p className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
    </form>
  );
}

interface JobDetails {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  url: string | null;
  notes: string;
  nextAction: string | null;
  nextActionAt: string;
}

export function JobDetailsForm({ job }: { job: JobDetails }) {
  const [state, formAction, pending] = useActionState<JobFormState, FormData>(updateJob.bind(null, job.id), { error: null });

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Next step">
        <input name="nextAction" defaultValue={job.nextAction ?? ""} placeholder="Follow up with the recruiter" className={input} />
      </Field>
      <Field label="Due">
        <input type="date" name="nextActionAt" defaultValue={job.nextActionAt} className={input} />
      </Field>
      <hr className="border-neutral-200 dark:border-neutral-800" />
      <Field label="Job title">
        <input name="title" required defaultValue={job.title} className={input} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <input name="company" defaultValue={job.company ?? ""} className={input} />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={job.location ?? ""} className={input} />
        </Field>
      </div>
      <Field label="Salary">
        <input name="salary" defaultValue={job.salary ?? ""} placeholder="$90–110k" className={input} />
      </Field>
      <Field label="Job ad link">
        <input type="url" name="url" defaultValue={job.url ?? ""} className={input} />
      </Field>
      <Field label="Notes">
        <textarea
          name="notes"
          rows={5}
          defaultValue={job.notes}
          placeholder="Who you reached out to, interview prep, questions to ask…"
          className={input}
        />
      </Field>
      {state.error && <p className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.ok && !pending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
