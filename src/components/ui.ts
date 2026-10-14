export const card = "rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";
export const input =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
export const primaryButton =
  "rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
export const secondaryButton =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export const STATUS_STYLES = {
  MATCHED: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  PARTIAL: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  MISSING: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:ring-rose-900",
} as const;

export const STATUS_LABELS = { MATCHED: "Matched", PARTIAL: "Partial", MISSING: "Missing" } as const;

export const CATEGORY_LABELS = {
  HARD_SKILL: "Skills",
  TOOL: "Tools & platforms",
  CERTIFICATION: "Certifications",
  EDUCATION: "Education",
  EXPERIENCE: "Experience",
  DOMAIN: "Domain knowledge",
  SOFT_SKILL: "Key soft skills",
} as const;
