import { z } from "zod";

// Nullable rather than optional everywhere: OpenAI strict structured output
// requires every field to be present.

export const CATEGORIES = [
  "hard_skill",
  "tool",
  "certification",
  "education",
  "experience",
  "domain",
  "soft_skill",
] as const;

export const extractionSchema = z.object({
  jobTitle: z.string().nullable().describe("Job title as written in the ad"),
  company: z.string().nullable().describe("Hiring company, if stated"),
  requirements: z.array(
    z.object({
      name: z
        .string()
        .describe("Canonical industry name, e.g. 'PostgreSQL', 'Kubernetes', 'AWS Certified Solutions Architect'"),
      aliases: z
        .array(z.string())
        .describe("Other spellings or abbreviations of this same skill, e.g. ['Postgres'] for PostgreSQL"),
      category: z.enum(CATEGORIES),
      importance: z.enum(["required", "preferred"]),
      detail: z
        .string()
        .nullable()
        .describe("Qualifier from the ad, e.g. '5+ years', 'in production', 'or equivalent experience'"),
    }),
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedRequirement = Extraction["requirements"][number];

export const comparisonSchema = z.object({
  results: z.array(
    z.object({
      id: z.number().int().describe("The requirement id from the list"),
      status: z.enum(["matched", "partial", "missing"]),
      evidence: z
        .string()
        .nullable()
        .describe("Short verbatim quote from the resume supporting the status; null when missing"),
      note: z
        .string()
        .nullable()
        .describe("For partial/missing: one concrete sentence on what is lacking. Null when matched"),
    }),
  ),
});

export type Comparison = z.infer<typeof comparisonSchema>;
