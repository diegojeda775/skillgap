import { normalizeKey } from "@/lib/analysis/merge";

const SKILLS_HEADING =
  /^(?:technical skills|core skills|key skills|skills(?: (?:and|&) (?:tools|technologies|abilities))?|core competencies|competencies|technologies|tech stack|tools(?: and technologies)?)\b\s*[:\-–]?\s*(.*)$/i;

const OTHER_HEADING =
  /^(?:experience|work experience|professional experience|employment|work history|education|projects|certifications?|licenses|summary|profile|objective|awards|honors|publications|volunteer(?:ing)?|interests|references|languages|activities)\b/i;

const MAX_SKILL_CHARS = 40;

/** Pulls the skills section out of resume text: "Skills: React, Node.js" or a heading followed by lists. */
export function parseSkillsFromText(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => SKILLS_HEADING.test(l) && l.length < 400);
  if (start === -1) return [];

  const collected = [lines[start].match(SKILLS_HEADING)?.[1] ?? ""];
  for (const line of lines.slice(start + 1)) {
    // A bare heading ends the section; "Languages: Python, Go" is a skill group, not a heading.
    if (OTHER_HEADING.test(line) && line.length < 40 && !/:\s*\S/.test(line)) break;
    if (isHeadingLike(line)) break;
    collected.push(line);
  }

  return dedupeSkills(
    collected
      .join("\n")
      // DOCX extraction can glue lines together: "VPNCustomer Service: …" → "VPN, Customer Service: …"
      .replace(/([A-Z]{2,})([A-Z][a-z]+(?: [A-Z][a-z]+)?:)/g, "$1, $2")
      .split(/[,;|•·▪●\n]|\s{2,}|\s[-–]\s/)
      // "Languages: Python, Go" → drop the group label
      .map((s) => s.replace(/^[^:]{1,25}:\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter((s) => s.length > 0 && s.length <= MAX_SKILL_CHARS),
  );
}

function isHeadingLike(line: string) {
  return line.length > 2 && line.length < 40 && line === line.toUpperCase() && /[A-Z]/.test(line) && !line.includes(",");
}

/** Keeps the first spelling of each skill ("React" and "React.js" count as one). */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  return skills.filter((s) => {
    const key = normalizeKey(s);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hasSkill(skills: string[], name: string) {
  const key = normalizeKey(name);
  return skills.some((s) => normalizeKey(s) === key);
}

/** The resume as the AI sees it: the text plus any skills added in the app. */
export function resumeForAnalysis(resume: { text: string; skills: string[] }) {
  if (resume.skills.length === 0) return resume.text;
  return `${resume.text}\n\nSkills: ${resume.skills.join(", ")}`;
}
