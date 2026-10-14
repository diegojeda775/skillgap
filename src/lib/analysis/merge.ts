import type { Comparison, ExtractedRequirement } from "./schemas";

export type Category = ExtractedRequirement["category"];
export type Status = Comparison["results"][number]["status"];

export interface MergedRequirement {
  key: string;
  name: string;
  aliases: string[];
  category: Category;
  importance: "required" | "preferred";
  detail: string | null;
  foundBy: string[];
}

export interface ResolvedRequirement extends MergedRequirement {
  status: Status;
  evidence: string | null;
  note: string | null;
  agreement: number;
}

// Common spellings that normalization alone can't unify.
const SYNONYMS: Record<string, string> = {
  js: "javascript",
  ecmascript: "javascript",
  ts: "typescript",
  k8s: "kubernetes",
  postgres: "postgresql",
  psql: "postgresql",
  golang: "go",
  "amazon web services": "aws",
  gcp: "google cloud",
  "google cloud platform": "google cloud",
  azure: "microsoft azure",
  "ms azure": "microsoft azure",
  "ci cd": "cicd",
  "c sharp": "c#",
  "react native js": "react native",
  ml: "machine learning",
  ai: "artificial intelligence",
  nlp: "natural language processing",
  "rest api": "rest",
  "restful api": "rest",
  "restful apis": "rest",
  "rest apis": "rest",
  // Soft skills: models phrase these many ways ("skills" suffix is stripped first).
  communications: "communication",
  "written communication": "communication",
  "verbal communication": "communication",
  "oral communication": "communication",
  "written and verbal communication": "communication",
  "verbal and written communication": "communication",
  "interpersonal communication": "communication",
  "customer interaction": "customer service",
  "customer facing": "customer service",
  organization: "organizational",
  organisational: "organizational",
  organisation: "organizational",
  organizing: "organizational",
  "team work": "teamwork",
  collaboration: "teamwork",
  "problem solving": "problem solving",
  "problem solver": "problem solving",
};

/** Normalized identity for a skill name: "React.js" and "ReactJS" both become "react". */
export function normalizeKey(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\.js\b/g, "js")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\.(?!net\b)/g, " ") // keep ".net", drop other dots
    .replace(/\s+/g, " ")
    .trim();

  if (s.endsWith("js") && s.length >= 4 && !s.endsWith(" js")) s = s.slice(0, -2).trim();
  s = s.replace(/ skills?$/, "");
  return SYNONYMS[s] ?? s;
}

export interface ProviderExtraction {
  provider: string;
  requirements: ExtractedRequirement[];
}

/**
 * Merges requirement lists from several providers into one deduplicated list.
 * Two entries merge when any of their names or aliases normalize to the same key.
 */
export function mergeRequirements(extractions: ProviderExtraction[]): MergedRequirement[] {
  type Entry = { provider: string; req: ExtractedRequirement; keys: string[] };
  const entries: Entry[] = [];

  for (const { provider, requirements } of extractions) {
    for (const req of requirements) {
      const nameKey = normalizeKey(req.name);
      if (!nameKey) continue;
      const aliasKeys = req.aliases.map(normalizeKey).filter(Boolean);
      entries.push({ provider, req, keys: [...new Set([nameKey, ...aliasKeys])] });
    }
  }

  // Union-find over entries that share a key. If one provider listed two items
  // separately it meant them as distinct, so groups holding different names from
  // the same provider never merge (e.g. "SQL" aliased to "PostgreSQL" elsewhere).
  const parent = entries.map((_, i) => i);
  const namesByProvider = entries.map((e) => new Map([[e.provider, new Set([e.keys[0]])]]));
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => {
    const [ra, rb] = [find(a), find(b)];
    if (ra === rb) return;
    for (const [provider, names] of namesByProvider[rb]) {
      const other = namesByProvider[ra].get(provider);
      if (other && new Set([...other, ...names]).size > 1) return;
    }
    for (const [provider, names] of namesByProvider[rb]) {
      namesByProvider[ra].set(provider, new Set([...(namesByProvider[ra].get(provider) ?? []), ...names]));
    }
    parent[rb] = ra;
  };

  const ownerOfKey = new Map<string, number>();
  entries.forEach((entry, i) => {
    for (const key of entry.keys) {
      const owner = ownerOfKey.get(key);
      if (owner === undefined) ownerOfKey.set(key, i);
      else union(owner, i);
    }
  });

  const groups = new Map<number, Entry[]>();
  entries.forEach((entry, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), entry]);
  });

  const merged: MergedRequirement[] = [];

  for (const group of groups.values()) {
    const name = mostCommon(group.map((e) => e.req.name.trim()));
    const key = normalizeKey(name);
    const foundBy = [...new Set(group.map((e) => e.provider))];
    const category = mostCommon(group.map((e) => e.req.category));
    const requiredVotes = group.filter((e) => e.req.importance === "required").length;
    const importance = requiredVotes * 2 >= group.length ? "required" : "preferred";

    // Soft skills only when the ad requires them; "preferred" ones are usually filler.
    if (category === "soft_skill" && importance !== "required") continue;

    const aliases = new Map<string, string>();
    for (const e of group) {
      for (const alias of [e.req.name, ...e.req.aliases]) {
        const k = normalizeKey(alias);
        if (k && k !== key && !aliases.has(k)) aliases.set(k, alias.trim());
      }
    }

    merged.push({
      key,
      name,
      aliases: [...aliases.values()],
      category,
      importance,
      detail: group.find((e) => e.req.detail)?.req.detail ?? null,
      foundBy,
    });
  }

  // An alias that is also a separate item would blur the two in the compare step.
  const itemKeys = new Set(merged.map((m) => m.key));
  for (const m of merged) m.aliases = m.aliases.filter((a) => !itemKeys.has(normalizeKey(a)));

  return merged.sort(
    (a, b) =>
      Number(b.importance === "required") - Number(a.importance === "required") ||
      b.foundBy.length - a.foundBy.length,
  );
}

const SCORE: Record<Status, number> = { matched: 2, partial: 1, missing: 0 };

/**
 * Combines each provider's verdicts into one status per requirement by averaging
 * scores, so a matched/missing split lands on "partial" rather than either extreme.
 * `comparisons` must be in provider priority order; evidence comes from the first
 * provider whose verdict agrees with the final status.
 */
export function resolveStatuses(requirements: MergedRequirement[], comparisons: Comparison[]): ResolvedRequirement[] {
  return requirements.map((req, id) => {
    const votes = comparisons
      .map((c) => c.results.find((r) => r.id === id))
      .filter((v): v is Comparison["results"][number] => v !== undefined);

    if (votes.length === 0) {
      return { ...req, status: "missing", evidence: null, note: "Could not be assessed.", agreement: 0 };
    }

    const avg = votes.reduce((sum, v) => sum + SCORE[v.status], 0) / votes.length;
    const status: Status = avg >= 1.5 ? "matched" : avg >= 0.5 ? "partial" : "missing";
    const agreeing = votes.filter((v) => v.status === status);
    // On a split verdict nobody voted for the averaged status, so fall back to any vote.
    const pool = agreeing.length ? agreeing : votes;

    return {
      ...req,
      status,
      evidence:
        status === "missing" ? null : (pool.find((v) => v.status !== "missing" && v.evidence)?.evidence ?? null),
      note:
        status === "matched"
          ? null
          : (pool.find((v) => v.status !== "matched" && v.note)?.note ??
            (agreeing.length ? null : "The AI models disagreed on this one; check it yourself.")),
      agreement: agreeing.length / votes.length,
    };
  });
}

function mostCommon<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  for (const [v, n] of counts) if (n > counts.get(best)!) best = v;
  return best;
}
