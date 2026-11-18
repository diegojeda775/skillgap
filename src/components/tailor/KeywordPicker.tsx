"use client";

import { Check, ChevronDown, Wand2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { createTailoredResume, type TailorFormState } from "@/app/tailor/actions";
import type { ItemCategory, MatchStatus } from "@/generated/prisma/enums";
import { keywordItems, weightedPercent } from "@/lib/tailor/keywords";
import { CATEGORY_LABELS, input, primaryButton } from "../ui";
import { MatchMeter } from "./MatchMeter";

export interface PickerItem {
  id: string;
  name: string;
  aliases: string[];
  category: ItemCategory;
  importance: "REQUIRED" | "PREFERRED";
  /** What the AI graders found in the master resume. */
  status: MatchStatus;
  note: string | null;
  evidence: string | null;
  /** The keyword already appears word for word in the master resume. */
  present: boolean;
}

interface Props {
  jobId: string;
  analysisId: string;
  items: PickerItem[];
  target: number;
  /** Ids chosen for the previous resume, when changing keywords. */
  previous?: string[];
  submitLabel?: string;
}

// Degrees and years of experience can't be added by changing wording.
const SELECTABLE = new Set<ItemCategory>(["HARD_SKILL", "TOOL", "DOMAIN", "SOFT_SKILL", "CERTIFICATION"]);

const GROUPS: { status: MatchStatus; title: string; hint: string }[] = [
  {
    status: "MATCHED",
    title: "You have these",
    hint: "Your resume shows this experience, just not in the job ad's words.",
  },
  {
    status: "PARTIAL",
    title: "Close matches",
    hint: "Your resume shows something related. Select the ones you really have.",
  },
  {
    status: "MISSING",
    title: "Not on your resume",
    hint: "Nothing in your profile shows these. Select one only if you have it, and say where you used it.",
  },
];

export function KeywordPicker({ jobId, analysisId, items, target, previous, submitLabel = "Create tailored resume" }: Props) {
  const selectable = useMemo(() => items.filter((i) => !i.present && SELECTABLE.has(i.category)), [items]);
  const [selected, setSelected] = useState<Set<string>>(
    // By default, everything the resume already supports is added.
    () => new Set(previous ?? selectable.filter((i) => i.status === "MATCHED").map((i) => i.id)),
  );
  const [details, setDetails] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<TailorFormState, FormData>(createTailoredResume.bind(null, jobId), {
    error: null,
  });

  const scored = keywordItems(items);
  const baseline = weightedPercent(scored, (i) => i.present);
  const projected = weightedPercent(scored, (i) => i.present || selected.has(i.id));
  const present = items.filter((i) => i.present);
  const fixed = items.filter((i) => !i.present && !SELECTABLE.has(i.category) && i.status !== "MATCHED");

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <form action={formAction} className="space-y-6 pb-24">
      <input type="hidden" name="analysisId" value={analysisId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="keyword" value={id} />
      ))}

      <MatchMeter baseline={baseline} score={projected} target={target} label="With your selection" baselineLabel="Your resume now" />

      {selectable.length === 0 && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Every keyword you could add is already in your resume. You can still create a version focused on this job.
        </p>
      )}

      {GROUPS.map((group) => {
        const groupItems = selectable
          .filter((i) => i.status === group.status)
          .sort((a, b) => Number(b.importance === "REQUIRED") - Number(a.importance === "REQUIRED"));
        if (groupItems.length === 0) return null;
        const ids = groupItems.map((i) => i.id);
        const allOn = ids.every((id) => selected.has(id));

        return (
          <fieldset key={group.status}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <legend className="text-sm font-semibold">
                  {group.title} <span className="font-normal text-neutral-400">({groupItems.length})</span>
                </legend>
                <p className="text-xs text-neutral-500">{group.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(ids, !allOn)}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              >
                {allOn ? "Clear all" : "Select all"}
              </button>
            </div>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {groupItems.map((item) => {
                const on = selected.has(item.id);
                return (
                  <li key={item.id} className={on ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-white dark:bg-neutral-900"}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggle([item.id], e.target.checked)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 ${
                          on ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-950"
                        }`}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                              item.importance === "REQUIRED"
                                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            }`}
                          >
                            {item.importance === "REQUIRED" ? "Required" : "Nice to have"}
                          </span>
                          <span className="text-xs text-neutral-400">{CATEGORY_LABELS[item.category]}</span>
                        </span>
                        {(item.status === "MATCHED" ? item.evidence : item.note) && (
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            {item.status === "MATCHED" ? `From your resume: “${item.evidence}”` : item.note}
                          </span>
                        )}
                      </span>
                    </label>
                    {on && item.status !== "MATCHED" && (
                      <div className="px-3 pb-3 pl-[2.6rem]">
                        <input
                          name={`detail:${item.id}`}
                          value={details[item.id] ?? ""}
                          onChange={(e) => setDetails((d) => ({ ...d, [item.id]: e.target.value }))}
                          maxLength={300}
                          placeholder={`Where did you use ${item.name}? (optional, but gives a stronger resume)`}
                          aria-label={`Where you used ${item.name}`}
                          className={`${input} text-xs`}
                        />
                        <p className="mt-1 text-[11px] text-neutral-400">
                          {details[item.id]?.trim()
                            ? "Saved to your profile and used to write a bullet."
                            : "Without details it's added to your skills section only."}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      {present.length > 0 && (
        <Disclosure title="Already in your resume" count={present.length}>
          <ul className="flex flex-wrap gap-1.5">
            {present.map((i) => (
              <li key={i.id} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900">
                {i.name}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {fixed.length > 0 && (
        <Disclosure title="Gaps that wording can't close" count={fixed.length}>
          <ul className="space-y-2">
            {fixed.map((i) => (
              <li key={i.id} className="text-sm">
                <span className="font-medium">{i.name}</span>
                <span className="ml-2 text-xs text-neutral-400">
                  {CATEGORY_LABELS[i.category]} · {i.importance === "REQUIRED" ? "Required" : "Nice to have"}
                </span>
                {i.note && <p className="text-xs text-neutral-500">{i.note}</p>}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold tabular-nums">{projected}% match</span>
            <span className="text-neutral-500">
              {" "}
              · {selected.size} {selected.size === 1 ? "keyword" : "keywords"} to add
              {projected < target && ` · target ${target}%`}
            </span>
            {state.error && <span className="block text-rose-700 dark:text-rose-400">{state.error}</span>}
          </p>
          <button type="submit" disabled={pending} className={`${primaryButton} flex shrink-0 items-center gap-1.5`}>
            <Wand2 className="size-4" aria-hidden />
            {pending ? "Starting…" : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

function Disclosure({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-neutral-200 dark:border-neutral-800">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>
          {title} <span className="font-normal text-neutral-400">({count})</span>
        </span>
        <ChevronDown className="size-4 text-neutral-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-neutral-100 p-3 dark:border-neutral-800">{children}</div>
    </details>
  );
}
