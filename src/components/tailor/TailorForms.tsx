"use client";

import { useActionState } from "react";
import { saveMasterNotes, type TailorFormState } from "@/app/tailor/actions";
import { input, primaryButton } from "../ui";

export function MasterNotesForm({ resumeId, notes }: { resumeId: string; notes: string }) {
  const [state, formAction, pending] = useActionState<TailorFormState, FormData>(saveMasterNotes.bind(null, resumeId), {
    error: null,
  });
  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="notes"
        defaultValue={notes}
        rows={8}
        placeholder={"- Built a Python script that automated weekly AD account audits (2023)\n- Jamf: enrolled and managed 40 MacBooks at Acme\n- CompTIA A+ in progress, exam scheduled for March"}
        className={`${input} leading-relaxed`}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save notes"}
        </button>
        {state.ok && !pending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </form>
  );
}
