"use client";

import { useActionState } from "react";
import { type ResumeFormState, updateResume } from "@/app/resumes/actions";
import { input, primaryButton } from "../ui";

export function ResumeTextForm({ resumeId, label, text }: { resumeId: string; label: string | null; text: string }) {
  const [state, formAction, pending] = useActionState<ResumeFormState, FormData>(updateResume.bind(null, resumeId), {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Version name</span>
        <input name="label" defaultValue={label ?? ""} placeholder="e.g. IT Support" className={`${input} mt-1`} />
      </label>
      <label className="block text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">Resume text</span>
        <textarea name="text" defaultValue={text} rows={18} className={`${input} mt-1 font-mono text-xs leading-relaxed`} />
      </label>
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
