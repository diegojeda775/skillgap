import "server-only";
import type { AnalysisItem } from "@/generated/prisma/client";
import { callStructured } from "@/lib/analysis/pipeline";
import { getProviders } from "@/lib/analysis/providers";
import { db } from "@/lib/db";
import { DOCX_MIME, resumeText } from "@/lib/ingest/resume";
import { applyParagraphEdits, listParagraphs } from "@/lib/resume/docx";
import { parseSkillsFromText } from "@/lib/resume/skills";
import { keywordItems, keywordMatch, weightedPercent } from "./keywords";
import { sanitizeEdits, WRITER_SYSTEM, type WriterOutput, writerPrompt, writerSchema } from "./writer";

const MAX_ROUNDS = 3;
const MAX_WORDS = 700;

export interface SelectedKeyword {
  /** AnalysisItem id. */
  id: string;
  name: string;
  /** Where the user used it, in their words. */
  detail: string | null;
}

/**
 * Creates a tailored resume from the master and the keywords the user chose:
 *   1. the writer rewrites the master's DOCX in place to work the chosen keywords in
 *   2. repeat until every chosen keyword is in, it stops improving, or MAX_ROUNDS
 *   3. save the best version as a new resume linked to the job
 * Takes only an id so it can move to a queue worker unchanged.
 */
export async function runTailor(runId: string) {
  try {
    const run = await db.tailorRun.findUniqueOrThrow({
      where: { id: runId },
      include: { master: { omit: { file: false } }, job: true },
    });
    const { master, job } = run;
    if (!master.file || master.mimeType !== DOCX_MIME) throw new Error("The master resume must be a Word (.docx) file.");
    if (!job) throw new Error("The job for this run was deleted.");
    if (!run.baselineAnalysisId) throw new Error("This job hasn't been analyzed yet.");

    // Claude writes first; if it fails (outage, bad key) the next provider takes over.
    const writers = getProviders().sort((a, b) => Number(b.id === "claude") - Number(a.id === "claude"));
    if (writers.length === 0) throw new Error("No AI provider is configured. Add at least one API key.");

    const analysis = await db.analysis.findUniqueOrThrow({ where: { id: run.baselineAnalysisId }, include: { items: true } });
    const items = keywordItems(analysis.items);
    const selected = new Map(((run.selected ?? []) as unknown as SelectedKeyword[]).map((k) => [k.id, k]));
    const masterDocx = Buffer.from(master.file);
    const masterMatch = keywordMatch(master.text, items);
    const chosen = (i: AnalysisItem) => selected.has(i.id) || masterMatch.present.has(i.id);
    const ceiling = weightedPercent(items, chosen);
    await db.tailorRun.update({
      where: { id: runId },
      data: { status: "WRITING", error: null, baselineScore: masterMatch.score, ceilingScore: ceiling },
    });

    const paragraphs = await listParagraphs(masterDocx);
    const sourceText = `${master.text}\n${master.notes}`;
    let best: { docx: Buffer; text: string; score: number; present: Set<string> } | null = null;
    let stillMissing: string[] | undefined;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const prompt = writerPrompt({
        jobTitle: job.title,
        company: job.company,
        jobText: job.description,
        paragraphs,
        notes: master.notes,
        toAdd: items
          .filter((i) => selected.has(i.id) && !masterMatch.present.has(i.id))
          .map((i) => ({
            name: i.name,
            importance: i.importance,
            // The user's own account wins; the graders' quote backs keywords the master already shows.
            evidence: selected.get(i.id)?.detail ?? (i.status === "MATCHED" ? i.evidence : null),
          })),
        alreadyPresent: items.filter((i) => masterMatch.present.has(i.id)).map((i) => i.name),
        unsupported: items.filter((i) => !chosen(i)).map((i) => i.name),
        maxWords: MAX_WORDS,
        stillMissing,
      });
      let output: WriterOutput | null = null;
      for (const writer of writers) {
        output = await callStructured(analysis.id, writer, "WRITE", writerSchema, WRITER_SYSTEM, prompt);
        if (output) break;
      }
      if (!output) {
        if (best) break;
        throw new Error("The AI couldn't rewrite the resume. Try again in a moment.");
      }

      const docx = await applyParagraphEdits(masterDocx, sanitizeEdits(output, paragraphs, sourceText));
      const text = await resumeText(docx, DOCX_MIME);
      const { score, present } = keywordMatch(text, items);
      const improved = !best || score > best.score;
      if (improved) best = { docx, text, score, present };
      await db.tailorRun.update({ where: { id: runId }, data: { rounds: round, finalScore: best!.score } });

      if (best!.score >= ceiling || !improved) break;
      stillMissing = items.filter((i) => chosen(i) && !best!.present.has(i.id)).map((i) => i.name);
    }
    if (!best) throw new Error("The AI couldn't rewrite the resume.");

    const label = job.company ? `${job.title} – ${job.company}` : job.title;
    const tailored = await db.resume.create({
      data: {
        userId: run.userId,
        label,
        fileName: `${label.replace(/[\\/:*?"<>|]+/g, "-")}.docx`,
        mimeType: DOCX_MIME,
        file: new Uint8Array(best.docx),
        text: best.text,
        skills: parseSkillsFromText(best.text),
        sourceResumeId: master.id,
      },
    });

    const summary = (i: AnalysisItem) => ({ name: i.name, importance: i.importance });
    const bestPresent = best.present;
    await db.$transaction([
      db.job.update({ where: { id: job.id }, data: { resumeId: tailored.id, matchScore: best.score } }),
      db.tailorRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETE",
          completedAt: new Date(),
          resultResumeId: tailored.id,
          finalScore: best.score,
          added: items.filter((i) => bestPresent.has(i.id) && !masterMatch.present.has(i.id)).map(summary),
          notAdded: items.filter((i) => chosen(i) && !bestPresent.has(i.id)).map(summary),
          gaps: items.filter((i) => !chosen(i)).map(summary),
        },
      }),
    ]);
  } catch (error) {
    console.error(`Tailor run ${runId} failed`, error);
    await db.tailorRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Unexpected error" },
    });
  }
}
