"use client";

import { Check, Plus, Wand2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import type { ItemCategory, MatchStatus } from "@/generated/prisma/enums";
import { providerLabel } from "@/lib/analysis/provider-labels";
import { CopyButton } from "../CopyButton";
import { card, CATEGORY_LABELS, primaryButton, STATUS_LABELS, STATUS_STYLES } from "../ui";

export interface ResultItem {
  id: string;
  name: string;
  category: ItemCategory;
  importance: "REQUIRED" | "PREFERRED";
  detail: string | null;
  status: MatchStatus;
  evidence: string | null;
  note: string | null;
  foundBy: string[];
  agreement: number;
  /** Already listed in the resume's skills section. */
  inResume: boolean;
}

// Categories that belong in a skills section; degrees, years of experience and
// certifications you don't hold can't be added honestly.
const ADDABLE = new Set<ItemCategory>(["HARD_SKILL", "TOOL", "DOMAIN", "SOFT_SKILL"]);
const selectable = (item: ResultItem) => ADDABLE.has(item.category) && !item.inResume;

interface Props {
  analysisId: string;
  items: ResultItem[];
  initialView: "gaps" | "keywords";
  resume: { id: string; label: string };
}

export function AnalysisResults({ analysisId, items, initialView, resume }: Props) {
  const [view, setView] = useState(initialView);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const switchView = (next: "gaps" | "keywords") => {
    setView(next);
    window.history.replaceState(null, "", next === "keywords" ? "?view=keywords" : window.location.pathname);
  };

  const chosen = items.filter((i) => selected.has(i.id));
  const tailorHref = `/analyses/${analysisId}/tailor?${new URLSearchParams(chosen.map((i) => ["add", i.name]))}`;
  const gaps = items.filter((i) => i.status !== "MATCHED");

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-1" role="tablist">
          <Tab active={view === "gaps"} onClick={() => switchView("gaps")}>
            Skill gaps ({gaps.length})
          </Tab>
          <Tab active={view === "keywords"} onClick={() => switchView("keywords")}>
            All keywords ({items.length})
          </Tab>
        </div>
        <Link href={tailorHref} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">
          <Wand2 className="size-4" aria-hidden /> Tailor resume
        </Link>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Select keywords to add to the skills section of{" "}
        <Link href={`/resumes/${resume.id}`} className="font-medium underline underline-offset-2">
          {resume.label}
        </Link>
        . You&apos;ll review and edit the wording before anything is saved. Only add skills you actually have.
      </p>

      {view === "gaps" ? (
        <Gaps items={gaps} selected={selected} onToggle={toggle} />
      ) : (
        <Keywords items={items} selected={selected} onToggle={toggle} />
      )}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-2xl items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">{chosen.length} selected:</span>{" "}
              <span className="text-neutral-600 dark:text-neutral-400">{chosen.map((i) => i.name).join(", ")}</span>
            </p>
            <button onClick={() => setSelected(new Set())} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              Clear
            </button>
            <Link href={tailorHref} className={`${primaryButton} flex shrink-0 items-center gap-1.5`}>
              <Wand2 className="size-4" aria-hidden /> Add to resume
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface ListProps {
  items: ResultItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function Gaps({ items, selected, onToggle }: ListProps) {
  const sorted = [...items].sort(
    (a, b) =>
      Number(b.importance === "REQUIRED") - Number(a.importance === "REQUIRED") ||
      Number(b.status === "MISSING") - Number(a.status === "MISSING"),
  );
  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-600 dark:text-neutral-400">No gaps found. Your resume covers everything the ad asks for.</p>;
  }

  return (
    <ul className="space-y-3">
      {sorted.map((item) => (
        <li key={item.id} className={`${card} ${selected.has(item.id) ? "ring-2 ring-emerald-500/60" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.name}</span>
            <Badge status={item.status} />
            <span className="text-xs text-neutral-500">
              {item.importance === "REQUIRED" ? "Required" : "Preferred"} · {CATEGORY_LABELS[item.category]}
              {item.detail && ` · ${item.detail}`}
            </span>
            <span className="ml-auto">
              {item.inResume ? (
                <InResume />
              ) : (
                selectable(item) && <SelectButton selected={selected.has(item.id)} onClick={() => onToggle(item.id)} />
              )}
            </span>
          </div>
          {item.note && <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{item.note}</p>}
          {item.evidence && (
            <p className="mt-2 border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              “{item.evidence}”
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Found by {item.foundBy.map(providerLabel).join(", ")}
            {item.agreement < 1 && ` · models agreed ${Math.round(item.agreement * 100)}% on the verdict`}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Keywords({ items, selected, onToggle }: ListProps) {
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => ({ label, items: items.filter((i) => i.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 text-xs">
          {(["MATCHED", "PARTIAL", "MISSING"] as const).map((s) => (
            <Badge key={s} status={s} />
          ))}
        </div>
        <CopyButton text={items.map((i) => i.name).join(", ")} label="Copy all keywords" />
      </div>
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-sm font-medium text-neutral-600 dark:text-neutral-400">{group.label}</h3>
          <ul className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const isSelected = selected.has(item.id);
              const title = item.inResume ? "Already in your resume's skills" : (item.evidence ?? item.note ?? undefined);
              const label = (
                <>
                  {item.name}
                  {item.importance === "PREFERRED" && <span className="opacity-60"> · preferred</span>}
                </>
              );
              return (
                <li key={item.id} title={title}>
                  {selectable(item) ? (
                    <button
                      onClick={() => onToggle(item.id)}
                      aria-pressed={isSelected}
                      className={`flex items-center gap-1.5 rounded-full py-1 pl-3 pr-2 text-sm ring-1 ring-inset transition ${STATUS_STYLES[item.status]} ${
                        isSelected ? "ring-2 ring-emerald-500" : "hover:brightness-95"
                      }`}
                    >
                      {label}
                      <span
                        className={`flex size-5 items-center justify-center rounded-full ${
                          isSelected ? "bg-emerald-600 text-white dark:bg-emerald-500" : "bg-white/70 dark:bg-black/20"
                        }`}
                      >
                        {isSelected ? <Check className="size-3" /> : <Plus className="size-3" />}
                      </span>
                    </button>
                  ) : (
                    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ring-1 ring-inset ${STATUS_STYLES[item.status]}`}>
                      {label}
                      {item.inResume && <Check className="size-3.5 opacity-70" aria-label="in resume" />}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SelectButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        selected
          ? "bg-emerald-600 text-white dark:bg-emerald-500"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      }`}
    >
      {selected ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
      {selected ? "Selected" : "Add to resume"}
    </button>
  );
}

function InResume() {
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
      <Check className="size-3.5" aria-hidden /> In resume skills
    </span>
  );
}

function Badge({ status }: { status: MatchStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active ? "border-neutral-900 font-medium dark:border-white" : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
