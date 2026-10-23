"use client";

import { type ReactNode, useActionState, useEffect, useRef } from "react";
import { createJob, type JobFormState } from "@/app/jobs/actions";
import type { JobStage } from "@/generated/prisma/enums";
import { STAGE_BY_ID } from "@/lib/jobs/stages";
import { input, primaryButton, secondaryButton } from "../ui";
import { Dialog } from "../Dialog";

interface Props {
  open: boolean;
  stage: JobStage;
  resumes: { id: string; label: string }[];
  onClose: () => void;
}

export function AddJobDialog({ open, stage, resumes, onClose }: Props) {
  const [state, formAction, pending] = useActionState<JobFormState, FormData>(createJob, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef(state);

  // Close once a save succeeds; the board refreshes from the server.
  useEffect(() => {
    if (state !== handled.current && state.ok) {
      formRef.current?.reset();
      onClose();
    }
    handled.current = state;
  }, [state, onClose]);

  return (
    <Dialog open={open} onClose={onClose} title={`Add job to ${STAGE_BY_ID[stage].label}`} wide>
      <form ref={formRef} action={formAction} className="space-y-4">
        <input type="hidden" name="stage" value={stage} />
        <Field label="Link to the job ad">
          <input type="url" name="url" placeholder="https://jobs.lever.co/…" className={input} />
        </Field>
        <p className="-mt-2 text-xs text-neutral-500">
          The ad is saved with the job, so you can analyze it later even if the posting comes down. LinkedIn and
          Indeed need a login, so paste those below.
        </p>
        <Field label="Or paste the job ad">
          <textarea name="description" rows={5} className={`${input} font-mono text-xs`} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Job title" hint="Filled in from the link if left blank">
            <input name="title" className={input} />
          </Field>
          <Field label="Company">
            <input name="company" className={input} />
          </Field>
          <Field label="Location">
            <input name="location" placeholder="Remote, Austin TX…" className={input} />
          </Field>
          <Field label="Resume version">
            <select name="resumeId" defaultValue={resumes[0]?.id ?? ""} className={input}>
              <option value="">None yet</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {state.error && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Saving…" : "Save job"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
      {hint && <span className="ml-1 text-xs text-neutral-400">({hint})</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}
