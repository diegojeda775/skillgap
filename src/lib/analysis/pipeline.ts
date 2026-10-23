import { generateText, Output } from "ai";
import type { z } from "zod";
import type { ItemCategory, PipelineStep } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resumeForAnalysis } from "@/lib/resume/skills";
import { mergeRequirements, resolveStatuses } from "./merge";
import { COMPARE_SYSTEM, comparePrompt, EXTRACT_SYSTEM, extractPrompt } from "./prompts";
import { getProviders, type Provider } from "./providers";
import { comparisonSchema, extractionSchema } from "./schemas";

const CALL_TIMEOUT_MS = 180_000;
// Results are a few thousand tokens; without a cap the SDK requests each model's maximum.
const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Runs a full analysis:
 *   1. every configured provider extracts requirements from the job ad (parallel)
 *   2. the lists are merged and deduplicated in code
 *   3. every provider grades the merged list against the resume (parallel)
 *   4. verdicts are combined per requirement and saved
 * A provider that fails is skipped; the analysis fails only if all of them do.
 *
 * Takes only an id so it can move to a queue worker (e.g. SQS + Lambda) unchanged.
 */
export async function runAnalysis(analysisId: string) {
  try {
    const analysis = await db.analysis.findUniqueOrThrow({
      where: { id: analysisId },
      include: { resume: true },
    });

    const providers = getProviders();
    if (providers.length === 0) throw new Error("No AI provider is configured. Add at least one API key.");

    await db.analysis.update({ where: { id: analysisId }, data: { status: "EXTRACTING", error: null } });

    const extractions = await runAll(providers, (p) =>
      callStructured(analysisId, p, "EXTRACT", extractionSchema, EXTRACT_SYSTEM, extractPrompt(analysis.jobText)),
    );
    if (extractions.length === 0) throw new Error("All AI providers failed to read the job ad.");

    const requirements = mergeRequirements(
      extractions.map(({ provider, output }) => ({ provider: provider.id, requirements: output.requirements })),
    );
    if (requirements.length === 0) throw new Error("No requirements were found in the job ad.");

    await db.analysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPARING",
        // Titles and companies entered by the user (or from the job board) win over extracted ones.
        jobTitle: analysis.jobTitle ?? firstValue(extractions.map((e) => e.output.jobTitle)),
        company: analysis.company ?? firstValue(extractions.map((e) => e.output.company)),
      },
    });

    const comparisons = await runAll(providers, (p) =>
      callStructured(
        analysisId,
        p,
        "COMPARE",
        comparisonSchema,
        COMPARE_SYSTEM,
        comparePrompt(resumeForAnalysis(analysis.resume), requirements),
      ),
    );
    if (comparisons.length === 0) throw new Error("All AI providers failed to compare the resume.");

    const resolved = resolveStatuses(
      requirements,
      comparisons.map((c) => c.output),
    );

    await db.$transaction([
      db.analysisItem.deleteMany({ where: { analysisId } }),
      db.analysisItem.createMany({
        data: resolved.map((r) => ({
          analysisId,
          key: r.key,
          name: r.name,
          aliases: r.aliases,
          category: r.category.toUpperCase() as ItemCategory,
          importance: r.importance === "required" ? "REQUIRED" : "PREFERRED",
          detail: r.detail,
          status: r.status === "matched" ? "MATCHED" : r.status === "partial" ? "PARTIAL" : "MISSING",
          evidence: r.evidence,
          note: r.note,
          foundBy: r.foundBy,
          agreement: r.agreement,
        })),
      }),
      db.analysis.update({
        where: { id: analysisId },
        data: { status: "COMPLETE", completedAt: new Date() },
      }),
    ]);
  } catch (error) {
    console.error(`Analysis ${analysisId} failed`, error);
    await db.analysis.update({
      where: { id: analysisId },
      data: { status: "FAILED", error: error instanceof Error ? error.message : "Unexpected error" },
    });
  }
}

/** Runs `fn` for every provider in parallel; keeps successes in provider order. */
async function runAll<T>(providers: Provider[], fn: (p: Provider) => Promise<T | null>) {
  const outputs = await Promise.all(providers.map(fn));
  const results: { provider: Provider; output: T }[] = [];
  outputs.forEach((output, i) => {
    if (output !== null) results.push({ provider: providers[i], output });
  });
  return results;
}

async function callStructured<T>(
  analysisId: string,
  provider: Provider,
  step: PipelineStep,
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
): Promise<T | null> {
  const startedAt = Date.now();
  const run = { analysisId, provider: provider.id, model: provider.modelId, step };

  try {
    const { output, usage } = await generateText({
      model: provider.model,
      output: Output.object({ schema }),
      system,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });

    await db.providerRun.create({
      data: {
        ...run,
        ok: true,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
      },
    });
    return output;
  } catch (error) {
    console.error(`${provider.label} ${step} failed`, error);
    await db.providerRun.create({
      data: {
        ...run,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
      },
    });
    return null;
  }
}

function firstValue(values: (string | null)[]) {
  return values.find((v) => v && v.trim())?.trim() ?? null;
}
