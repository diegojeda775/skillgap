import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { deleteCoverLetter } from "@/app/cover-letters/actions";
import type { CoverLetterStatus } from "@/generated/prisma/enums";
import { AutoRefresh } from "../AutoRefresh";
import { ConfirmButton } from "../ConfirmButton";
import { DownloadMenu } from "../resumes/DownloadMenu";
import { card, deleteIconButton } from "../ui";
import { LetterEditor, WriteLetterForm } from "./CoverLetterForms";

export interface PanelLetter {
  id: string;
  body: string;
  status: CoverLetterStatus;
  error: string | null;
  createdAt: Date;
  resumeName: string | null;
}

interface Props {
  jobId: string;
  /** Newest first. */
  letters: PanelLetter[];
  /** Name of the resume a new letter would be written from; null when there's none to use. */
  writesFrom: string | null;
  /** Mentions in the current letter that the candidate's background doesn't show. */
  unsupported: string[];
}

/** Write, edit and download the job's cover letter. */
export function CoverLetterPanel({ jobId, letters, writesFrom, unsupported }: Props) {
  const newest = letters.at(0);
  const complete = letters.filter((l) => l.status === "COMPLETE");
  const current = complete.at(0);
  const earlier = complete.slice(1);
  const writing = newest?.status === "WRITING";

  return (
    <section id="cover-letter" className={`${card} scroll-mt-6`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cover letter</h2>
          {current && (
            <p className="text-sm text-neutral-500">
              {current.resumeName ? `Written from ${current.resumeName}` : "The resume it was written from was deleted"} ·{" "}
              {current.createdAt.toLocaleDateString()}
            </p>
          )}
        </div>
        {current && (
          <div className="flex gap-2">
            <form action={deleteCoverLetter.bind(null, current.id)} className="flex">
              <ConfirmButton
                message="Delete this cover letter?"
                confirmLabel="Delete letter"
                aria-label="Delete cover letter"
                title="Delete cover letter"
                className={deleteIconButton}
              >
                <Trash2 className="size-4" aria-hidden />
              </ConfirmButton>
            </form>
            <DownloadMenu href={`/cover-letters/${current.id}/download`} isDocx />
          </div>
        )}
      </div>

      {newest?.status === "FAILED" && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {newest.error ?? "The letter couldn't be finished. Try again."}
        </p>
      )}
      {writing && (
        <p className={`flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 ${current ? "mb-4" : ""}`}>
          <AutoRefresh />
          <Loader2 className="size-4 animate-spin text-neutral-400" aria-hidden />
          {current ? "Writing a new version. This one is kept under Earlier versions." : "Writing your cover letter. Usually under a minute."}
        </p>
      )}

      {current && (
        <>
          {unsupported.length > 0 && (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                The letter mentions things that aren&apos;t in your resume or notes. Check them before you send it:{" "}
                <span className="font-medium">{unsupported.join(", ")}</span>
              </span>
            </p>
          )}
          <LetterEditor key={current.id} letterId={current.id} body={current.body} />
        </>
      )}

      {!writing &&
        (writesFrom === null ? (
          !current && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              <Link href="/profile" className="underline underline-offset-2">
                Upload your master resume
              </Link>{" "}
              first. The letter is written from it.
            </p>
          )
        ) : current ? (
          <details className="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-400">Write a new version</summary>
            <div className="mt-3">
              <p className="mb-3 text-sm text-neutral-500">Written from {writesFrom}. The current letter is kept.</p>
              <WriteLetterForm jobId={jobId} label="Write new version" subtle />
            </div>
          </details>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              AI writes a letter for this job from {writesFrom}, using only what&apos;s in your resume and notes. You can edit
              it before downloading.
            </p>
            <WriteLetterForm jobId={jobId} label="Write cover letter" />
          </>
        ))}

      {earlier.length > 0 && (
        <details className="mt-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Earlier versions ({earlier.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {earlier.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-neutral-500">{l.createdAt.toLocaleString()}</span>
                <DownloadMenu href={`/cover-letters/${l.id}/download`} isDocx />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
