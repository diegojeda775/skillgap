"use client";

import { Upload } from "lucide-react";
import { useActionState } from "react";
import { renameResume, replaceResumeFile, type ResumeFormState } from "@/app/resumes/actions";
import { input, primaryButton, secondaryButton } from "../ui";

export function RenameResumeForm({ resumeId, label }: { resumeId: string; label: string | null }) {
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(renameResume.bind(null, resumeId), {
    error: null,
  });
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input name="label" defaultValue={label ?? ""} placeholder="e.g. IT Support" aria-label="Version name" className={`${input} max-w-sm`} />
      <button type="submit" disabled={pending} className={secondaryButton}>
        {pending ? "Saving…" : "Rename"}
      </button>
      {state.ok && !pending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
    </form>
  );
}

export function ReplaceFileForm({ resumeId, prompt }: { resumeId: string; prompt: string }) {
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(replaceResumeFile.bind(null, resumeId), {
    error: null,
  });
  return (
    <form action={formAction} className="space-y-2">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{prompt}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          name="resume"
          required
          accept=".docx,.pdf,.txt"
          className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-800 dark:file:text-neutral-100"
        />
        <button type="submit" disabled={pending} className={`${primaryButton} flex items-center gap-1.5`}>
          <Upload className="size-4" aria-hidden />
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {state.error && <p className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
    </form>
  );
}
