import { Check, Target } from "lucide-react";

interface Props {
  score: number;
  target: number;
  label: string;
  /** Shown as a lighter segment under the score, e.g. the resume before tailoring. */
  baseline?: number;
  baselineLabel?: string;
  compact?: boolean;
}

/** ATS-style keyword match against a target, with an optional "before" marker. */
export function MatchMeter({ score, target, label, baseline, baselineLabel, compact }: Props) {
  const reached = score >= target;
  const tone = reached
    ? "text-emerald-600 dark:text-emerald-400"
    : score >= 70
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";
  const bar = reached ? "bg-emerald-500" : score >= 70 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className={compact ? "" : "rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950/40"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
          <p className={`${compact ? "text-3xl" : "text-4xl"} font-semibold tabular-nums transition-colors ${tone}`}>{score}%</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {baseline !== undefined && baselineLabel && (
            <span className="text-neutral-500">
              {baselineLabel} <span className="font-medium tabular-nums text-neutral-700 dark:text-neutral-300">{baseline}%</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-neutral-500">
            {reached ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Target className="size-4" aria-hidden />}
            Target <span className="font-medium tabular-nums text-neutral-700 dark:text-neutral-300">{target}%</span>
          </span>
        </div>
      </div>
      <div
        className="relative mt-3 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${score}%`}
      >
        {baseline !== undefined && (
          <div className="absolute inset-y-0 left-0 rounded-full bg-neutral-300 dark:bg-neutral-700" style={{ width: `${baseline}%` }} />
        )}
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${bar}`} style={{ width: `${score}%` }} />
        <div className="absolute -top-1 h-4.5 w-0.5 rounded bg-neutral-900 dark:bg-white" style={{ left: `${target}%` }} aria-hidden />
      </div>
    </div>
  );
}
