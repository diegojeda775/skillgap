"use client";

import { Check, Plus } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { addSkill, removeSkill } from "@/app/resumes/actions";
import type { MatchStatus } from "@/generated/prisma/enums";
import { STATUS_STYLES } from "./ui";

interface Props {
  resumeId: string;
  name: string;
  inSkills: boolean;
}

/** Toggles a keyword in the resume's skills section, updating instantly. */
function useSkillToggle({ resumeId, name, inSkills }: Props) {
  const [added, setAdded] = useOptimistic(inSkills);
  const [, startTransition] = useTransition();
  const toggle = () =>
    startTransition(async () => {
      setAdded(!added);
      await (added ? removeSkill(resumeId, name) : addSkill(resumeId, name));
    });
  return { added, toggle };
}

/** A keyword chip; addable ones end in a +/✓ button. */
export function KeywordChip({
  status,
  preferred,
  title,
  addable,
  ...props
}: Props & { status: MatchStatus; preferred: boolean; title?: string; addable: boolean }) {
  const { added, toggle } = useSkillToggle(props);
  const showToggle = addable && (status !== "MATCHED" || added);

  return (
    <li title={title} className={`flex items-center rounded-full text-sm ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      <span className={showToggle ? "py-1 pl-3 pr-1.5" : "px-3 py-1"}>
        {props.name}
        {preferred && <span className="opacity-60"> · preferred</span>}
      </span>
      {showToggle && (
        <button
          onClick={toggle}
          aria-pressed={added}
          aria-label={added ? `Remove ${props.name} from resume skills` : `Add ${props.name} to resume skills`}
          title={added ? "In your resume's skills. Click to remove." : "Add to your resume's skills"}
          className={`mr-1 flex size-6 items-center justify-center rounded-full transition ${
            added ? "bg-emerald-600 text-white dark:bg-emerald-500" : "bg-white/70 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40"
          }`}
        >
          {added ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
        </button>
      )}
    </li>
  );
}

export function AddSkillButton(props: Props) {
  const { added, toggle } = useSkillToggle(props);
  return (
    <button
      onClick={toggle}
      aria-pressed={added}
      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${
        added
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      }`}
    >
      {added ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
      {added ? "In resume skills" : "Add to resume skills"}
    </button>
  );
}
