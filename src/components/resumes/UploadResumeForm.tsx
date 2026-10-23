"use client";

import { Upload } from "lucide-react";
import { useActionState } from "react";
import { type ResumeFormState, uploadResume } from "@/app/resumes/actions";
import { input, primaryButton } from "../ui";

export function UploadResumeForm() {
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(uploadResume, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Version name</span>
        <input name="label" placeholder="e.g. IT Support, Frontend, Data Analyst" className={`${input} mt-1`} />
      </label>
      <label className="min-w-48 flex-1 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">File (PDF, DOCX or TXT)</span>
        <input
          type="file"
          name="resume"
          required
          accept=".pdf,.docx,.txt,.md"
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800 dark:file:text-neutral-100"
        />
      </label>
      <button type="submit" disabled={pending} className={`${primaryButton} flex items-center gap-1.5`}>
        <Upload className="size-4" aria-hidden />
        {pending ? "Reading…" : "Upload"}
      </button>
      {state.error && <p className="w-full text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
    </form>
  );
}
