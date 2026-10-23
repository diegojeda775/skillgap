"use client";

import { Plus, X } from "lucide-react";
import { useOptimistic, useRef, useTransition } from "react";
import { addSkill, importSkillsFromText, removeSkill } from "@/app/resumes/actions";
import { CopyButton } from "../CopyButton";
import { input, secondaryButton } from "../ui";

type Change = { type: "add" | "remove"; name: string };

export function SkillsEditor({ resumeId, skills }: { resumeId: string; skills: string[] }) {
  const [optimistic, apply] = useOptimistic(skills, (current: string[], change: Change) =>
    change.type === "add" ? [...current, change.name] : current.filter((s) => s !== change.name),
  );
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function add(formData: FormData) {
    const names = String(formData.get("skill") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (inputRef.current) inputRef.current.value = "";
    startTransition(async () => {
      for (const name of names) {
        apply({ type: "add", name });
        await addSkill(resumeId, name);
      }
    });
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label="Skills">
        {optimistic.map((skill) => (
          <li
            key={skill}
            className="flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm dark:bg-neutral-800"
          >
            {skill}
            <button
              onClick={() =>
                startTransition(async () => {
                  apply({ type: "remove", name: skill });
                  await removeSkill(resumeId, skill);
                })
              }
              className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
              aria-label={`Remove ${skill}`}
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        {optimistic.length === 0 && <li className="text-sm text-neutral-500">No skills yet.</li>}
      </ul>

      <form action={add} className="flex gap-2">
        <input ref={inputRef} name="skill" placeholder="Add skills, separated by commas" className={input} aria-label="New skill" />
        <button type="submit" className={`${secondaryButton} flex shrink-0 items-center gap-1`}>
          <Plus className="size-4" aria-hidden /> Add
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={`Skills: ${optimistic.join(", ")}`} label="Copy skills section" />
        <button
          onClick={() => startTransition(() => importSkillsFromText(resumeId))}
          disabled={pending}
          className={secondaryButton}
        >
          Re-import from resume text
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Analyses use these skills along with the resume text. Paste the copied section into your actual resume file
        when you send it.
      </p>
    </div>
  );
}
