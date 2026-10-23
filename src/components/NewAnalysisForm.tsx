"use client";

import { useActionState } from "react";
import { createAnalysis, type FormState } from "@/app/actions";
import { resumeLabel } from "@/lib/resume/label";
import { card, input, primaryButton } from "./ui";

interface SavedResume {
  id: string;
  fileName: string;
  label: string | null;
  createdAt: Date;
}

export function NewAnalysisForm({ resumes }: { resumes: SavedResume[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createAnalysis, { error: null });

  return (
    <form action={formAction} className="space-y-6">
      <section className={card}>
        <h2 className="font-medium">1. Your resume</h2>
        {resumes.length > 0 && (
          <label className="mt-3 block text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">Use a saved resume</span>
            <select name="resumeId" defaultValue={resumes[0].id} className={`${input} mt-1`}>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {resumeLabel(r)} · {r.createdAt.toLocaleDateString()}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="mt-3 block text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">
            {resumes.length > 0 ? "Or upload a new one" : "Upload PDF, DOCX or TXT (max 5 MB)"}
          </span>
          <input
            type="file"
            name="resume"
            accept=".pdf,.docx,.txt,.md"
            className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800 dark:file:text-neutral-100"
          />
        </label>
      </section>

      <section className={card}>
        <h2 className="font-medium">2. The job ad</h2>
        <label className="mt-3 block text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Link to the job ad</span>
          <input type="url" name="jobUrl" placeholder="https://boards.greenhouse.io/…" className={`${input} mt-1`} />
        </label>
        <p className="mt-1 text-xs text-neutral-500">
          Greenhouse, Lever, Ashby and most company career pages work. LinkedIn and Indeed need a login, so paste those.
        </p>
        <label className="mt-4 block text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Or paste the job ad text</span>
          <textarea name="jobText" rows={8} className={`${input} mt-1 font-mono text-xs`} />
        </label>
      </section>

      {state.error && (
        <p role="alert" className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-300">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Reading inputs…" : "Analyze"}
      </button>
    </form>
  );
}
