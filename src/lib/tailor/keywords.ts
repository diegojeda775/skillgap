import { normalizeKey } from "@/lib/analysis/merge";

// ATS-style keyword match: what share of the job's keywords literally appear in the resume.
// This is what tools like Jobscan report, and it's what tailoring the wording can improve.

export interface KeywordItem {
  id: string;
  name: string;
  aliases: string[];
  category: string; // ItemCategory
  importance: "REQUIRED" | "PREFERRED";
}

// "5+ years of backend development" isn't a keyword an ATS can match literally.
const SKIPPED_CATEGORIES = new Set(["EXPERIENCE"]);
const weight = (item: KeywordItem) => (item.importance === "REQUIRED" ? 2 : 1);

export function keywordItems<T extends KeywordItem>(items: T[]): T[] {
  return items.filter((i) => !SKIPPED_CATEGORIES.has(i.category));
}

/** Lowercased text with punctuation as spaces, padded so phrases can be matched on word boundaries. */
function normalizeText(text: string) {
  return ` ${text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\.(?!net\b)/g, " ")
    .replace(/\s+/g, " ")} `;
}

export function containsKeyword(normalizedText: string, item: KeywordItem) {
  for (const spelling of [item.name, ...item.aliases]) {
    for (const form of new Set([normalizeText(spelling).trim(), normalizeKey(spelling)])) {
      if (form && normalizedText.includes(` ${form} `)) return true;
    }
  }
  return false;
}

/** Weighted percent (required keywords count double) of `items` found in `text`, plus which ones. */
export function keywordMatch(text: string, items: KeywordItem[]) {
  const normalized = normalizeText(text);
  const considered = keywordItems(items);
  const present = new Set(considered.filter((i) => containsKeyword(normalized, i)).map((i) => i.id));
  return { score: weightedPercent(considered, (i) => present.has(i.id)), present };
}

export function weightedPercent<T extends KeywordItem>(items: T[], counts: (item: T) => boolean) {
  const total = items.reduce((sum, i) => sum + weight(i), 0);
  if (total === 0) return 100;
  return Math.round((100 * items.reduce((sum, i) => sum + (counts(i) ? weight(i) : 0), 0)) / total);
}
