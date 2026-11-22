import { type KeywordItem, keywordItems, keywordMatch } from "@/lib/tailor/keywords";

/**
 * Things a cover letter mentions that its sources don't: job keywords that aren't in the resume or
 * notes, and numbers that aren't in the resume, notes, or job ad. Worth a check before sending.
 */
export function unsupportedMentions(body: string, background: string, jobText: string, items: KeywordItem[]): string[] {
  const considered = keywordItems(items);
  const inLetter = keywordMatch(body, considered).present;
  const inBackground = keywordMatch(background, considered).present;
  const keywords = considered.filter((i) => inLetter.has(i.id) && !inBackground.has(i.id)).map((i) => i.name);

  const known = new Set(numbers(`${background}\n${jobText}`));
  const figures = numbers(body).filter((n) => !known.has(n));
  return [...new Set([...keywords, ...figures])];
}

/** "1,200 users" and "1200" compare equal. */
function numbers(text: string) {
  return (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.+$/, ""));
}
