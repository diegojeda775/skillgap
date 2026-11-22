"use client";

import { PenLine } from "lucide-react";
import { useActionState, useState } from "react";
import { createCoverLetter, type LetterFormState, saveCoverLetter } from "@/app/cover-letters/actions";
import { input, primaryButton, secondaryButton } from "../ui";

export function WriteLetterForm({ jobId, label, subtle }: { jobId: string; label: string; subtle?: boolean }) {
  const [state, formAction, pending] = useActionState<LetterFormState, FormData>(createCoverLetter.bind(null, jobId), {
    error: null,
  });
  // Controlled, so a failed submit doesn't clear it.
  const [instructions, setInstructions] = useState("");
  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Anything to mention? <span className="font-normal text-neutral-500">(optional)</span>
        </span>
        <textarea
          name="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Why you want this job, who referred you, the tone you'd like…"
          className={`${input} leading-relaxed`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`${subtle ? secondaryButton : primaryButton} flex items-center gap-1.5 disabled:opacity-50`}
      >
        <PenLine className="size-4" aria-hidden /> {pending ? "Starting…" : label}
      </button>
      {state.error && <p className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
    </form>
  );
}

export function LetterEditor({ letterId, body }: { letterId: string; body: string }) {
  const [state, formAction, pending] = useActionState<LetterFormState, FormData>(saveCoverLetter.bind(null, letterId), {
    error: null,
  });
  const [text, setText] = useState(body);
  const changed = text.trim() !== body.trim();
  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={18}
        maxLength={10000}
        aria-label="Cover letter text"
        className={`${input} leading-relaxed`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !changed} className={`${secondaryButton} disabled:opacity-50`}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state.error && <span className="text-sm text-rose-700 dark:text-rose-400">{state.error}</span>}
        {!pending && changed && !state.error && (
          <span className="text-sm text-amber-700 dark:text-amber-400">Save before downloading to include your changes.</span>
        )}
        {!pending && !changed && state.ok && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
      </div>
    </form>
  );
}
