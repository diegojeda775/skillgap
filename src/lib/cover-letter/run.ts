import "server-only";
import { callStructured } from "@/lib/analysis/pipeline";
import { getProviders } from "@/lib/analysis/providers";
import { db } from "@/lib/db";
import { keywordItems, keywordMatch } from "@/lib/tailor/keywords";
import { unsupportedMentions } from "./claims";
import { LETTER_SYSTEM, letterBody, type LetterOutput, letterPrompt, letterSchema } from "./writer";

const MAX_ATTEMPTS = 2;

/**
 * Writes a cover letter from the job ad and the candidate's resume. A letter that mentions something
 * the background doesn't support is rewritten once; whatever is left is flagged on the job page.
 * Takes only an id so it can move to a queue worker unchanged.
 */
export async function runCoverLetter(letterId: string) {
  try {
    const letter = await db.coverLetter.findUniqueOrThrow({ where: { id: letterId }, include: { job: true, resume: true } });
    const { job, resume } = letter;
    if (!resume) throw new Error("The resume for this letter was deleted.");

    // Claude writes first; if it fails (outage, bad key) the next provider takes over.
    const writers = getProviders().sort((a, b) => Number(b.id === "claude") - Number(a.id === "claude"));
    if (writers.length === 0) throw new Error("No AI provider is configured. Add at least one API key.");

    const [master, analysis] = await Promise.all([
      db.resume.findFirst({ where: { userId: letter.userId, isMaster: true } }),
      db.analysis.findFirst({
        where: { jobId: job.id, status: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      }),
    ]);
    const items = keywordItems(analysis?.items ?? []);
    const masterText = master && master.id !== resume.id ? master.text : null;
    const notes = master?.notes ?? "";
    const background = letterBackground(resume, master, letter.instructions);
    const { present } = keywordMatch(background, items);

    let best: { body: string; flagged: string[] } | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const prompt = letterPrompt({
        jobTitle: job.title,
        company: job.company,
        jobText: job.description,
        resumeText: resume.text,
        masterText,
        notes,
        strengths: items.filter((i) => present.has(i.id) || i.status === "MATCHED").map((i) => i.name),
        unsupported: items.filter((i) => !present.has(i.id) && i.status !== "MATCHED").map((i) => i.name),
        instructions: letter.instructions,
        flagged: best?.flagged,
      });
      let output: LetterOutput | null = null;
      for (const writer of writers) {
        output = await callStructured(analysis?.id ?? null, writer, "COVER_LETTER", letterSchema, LETTER_SYSTEM, prompt);
        if (output?.paragraphs.some((p) => p.trim())) break;
        output = null;
      }
      if (!output) break;

      const body = letterBody(output, background);
      const flagged = unsupportedMentions(body, background, job.description, items.filter((i) => i.status !== "MATCHED"));
      if (!best || flagged.length < best.flagged.length) best = { body, flagged };
      if (best.flagged.length === 0) break;
    }
    if (!best) throw new Error("The AI services didn't return a letter. Check the API keys in .env, or try again in a moment.");

    await db.coverLetter.updateMany({ where: { id: letterId }, data: { status: "COMPLETE", error: null, body: best.body } });
  } catch (error) {
    console.error(`Cover letter ${letterId} failed`, error);
    await db.coverLetter.updateMany({
      where: { id: letterId },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Unexpected error" },
    });
  }
}

/** Everything a letter may draw on: its resume, the master, the master's notes and the user's request. */
export function letterBackground(
  resume: { text: string } | null,
  master: { text: string; notes: string } | null,
  instructions: string,
) {
  return [resume?.text, master?.text, master?.notes, instructions].filter(Boolean).join("\n");
}
