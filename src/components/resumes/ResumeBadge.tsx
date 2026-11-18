export function ResumeBadge({ kind }: { kind: "master" | "tailored" }) {
  return kind === "master" ? (
    <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
      Master
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      Tailored
    </span>
  );
}
