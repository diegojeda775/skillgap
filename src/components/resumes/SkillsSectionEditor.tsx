"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useActionState, useState } from "react";
import type { ResumeFormState } from "@/app/resumes/actions";
import { input, primaryButton, secondaryButton } from "../ui";

interface Line {
  id: number;
  text: string;
  removed: boolean;
}

interface Props {
  action: (prev: ResumeFormState, formData: FormData) => Promise<ResumeFormState>;
  /** Lines as they'll be pre-filled (e.g. with new keywords already added). */
  lines: string[];
  /** Lines as they are in the document now; changed lines are highlighted against these. */
  originalLines: string[];
  submitLabel: string;
  /** Shows a name field for creating a new version. */
  name?: string;
  /** Keywords that were added to the lines, listed above the editor. */
  added?: string[];
}

const toLines = (texts: string[]): Line[] => texts.map((text, id) => ({ id, text, removed: false }));

export function SkillsSectionEditor({ action, lines: initial, originalLines, submitLabel, name, added }: Props) {
  const [lines, setLines] = useState(() => toLines(initial));
  const [nextId, setNextId] = useState(initial.length);
  const [state, formAction, pending] = useActionState(action, { error: null });

  const update = (id: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const visible = lines.filter((l) => !l.removed);

  return (
    <form action={formAction} className="space-y-4">
      {name !== undefined && (
        <label className="block text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">New version name</span>
          <input name="name" required defaultValue={name} className={`${input} mt-1`} />
        </label>
      )}

      {added && added.length > 0 && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Added <strong>{added.join(", ")}</strong> to the highlighted {added.length === 1 ? "line" : "lines"}. Edit the
          wording or move them to another line before saving.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Skills section, one box per line as it appears in your resume. Press Enter for a line break.
        </p>
        {lines.map((line) => {
          // Removed lines still submit an empty value so the editor stays aligned with the document.
          if (line.removed) return <input key={line.id} type="hidden" name="line" value="" />;
          const changed = line.text !== (originalLines[line.id] ?? "");
          return (
            <div key={line.id} className="flex items-start gap-2">
              <textarea
                name="line"
                value={line.text}
                onChange={(e) => update(line.id, { text: e.target.value })}
                rows={Math.max(1, line.text.split("\n").length)}
                aria-label={`Skills line ${line.id + 1}`}
                className={`${input} resize-y leading-relaxed ${
                  changed ? "border-emerald-400 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => update(line.id, { removed: true })}
                aria-label={`Remove skills line ${line.id + 1}`}
                className="mt-2 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-neutral-500">No lines. Add one below.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setLines((ls) => [...ls, { id: nextId, text: "", removed: false }]);
            setNextId((n) => n + 1);
          }}
          className={`${secondaryButton} flex items-center gap-1`}
        >
          <Plus className="size-4" aria-hidden /> Add line
        </button>
        <button
          type="button"
          onClick={() => {
            setLines(toLines(initial));
            setNextId(initial.length);
          }}
          className={`${secondaryButton} flex items-center gap-1`}
        >
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </button>
      </div>

      {state.error && <p className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {state.ok && !pending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved to your resume file</span>}
      </div>
    </form>
  );
}
