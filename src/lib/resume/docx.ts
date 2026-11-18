import { DOMParser, type Document, type Element, type Node, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import { isHeadingLike, OTHER_HEADING, SKILLS_HEADING } from "./skills";

// Edits the Skills section of a .docx in place. Only the text inside existing runs changes,
// so fonts, bold labels, bullets, spacing and layout stay exactly as the user designed them.

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML = "http://www.w3.org/XML/1998/namespace";
const DOCUMENT_PATH = "word/document.xml";
const MAX_SECTION_LINES = 15;

interface Piece {
  node: Element;
  text: string; // "\n" for a line break, "\t" for a tab
}

interface Paragraph {
  el: Element;
  pieces: Piece[];
  text: string;
}

export interface SkillsSection {
  /** False when the document has no recognizable Skills section; saving then appends one. */
  found: boolean;
  /** One entry per paragraph in the section, line breaks inside a paragraph as "\n". */
  lines: string[];
}

export async function readSkillsSection(docx: Buffer): Promise<SkillsSection> {
  const { doc } = await load(docx);
  const section = findSection(paragraphs(doc));
  return section ? { found: true, lines: section.map((p) => p.text) } : { found: false, lines: [] };
}

/** Returns a new .docx with the Skills section lines replaced. Empty lines remove that paragraph. */
export async function writeSkillsSection(docx: Buffer, newLines: string[]): Promise<Buffer> {
  const { zip, doc, declaration } = await load(docx);
  const all = paragraphs(doc);
  const section = findSection(all);

  if (!section) {
    appendParagraphs(doc, all, newLines.filter((l) => l.trim()));
  } else {
    let last = section[section.length - 1].el;
    newLines.forEach((line, i) => {
      const existing = section[i];
      if (existing) {
        if (!line.trim()) existing.el.parentNode?.removeChild(existing.el);
        else if (line !== existing.text) editParagraph(existing, line);
        if (line.trim()) last = existing.el;
      } else if (line.trim()) {
        const clone = cloneWithText(section[section.length - 1].el, line);
        last.parentNode?.insertBefore(clone, last.nextSibling);
        last = clone;
      }
    });
    for (const extra of section.slice(newLines.length)) extra.el.parentNode?.removeChild(extra.el);
  }

  const xml = new XMLSerializer().serializeToString(doc);
  zip.file(DOCUMENT_PATH, xml.startsWith("<?xml") ? xml : declaration + xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export interface DocParagraph {
  /** Stable index of the paragraph in the document; pass it back to applyParagraphEdits. */
  id: number;
  text: string;
  /** Headings, contact details and job title/date lines, which tailoring must not change. */
  locked: boolean;
}

export interface ParagraphEdits {
  rewrite: { id: number; text: string }[];
  remove: number[];
  /** New paragraphs styled like the one they follow (e.g. another bullet under the same job). */
  insertAfter: { afterId: number; text: string }[];
}

/** Every non-empty paragraph with its id and whether it may be edited. */
export async function listParagraphs(docx: Buffer): Promise<DocParagraph[]> {
  const { doc } = await load(docx);
  return classify(paragraphs(doc)).filter((p) => p.text.trim());
}

/** Applies rewrites, removals and inserts to unlocked paragraphs, keeping each run's formatting. */
export async function applyParagraphEdits(docx: Buffer, edits: ParagraphEdits): Promise<Buffer> {
  const { zip, doc, declaration } = await load(docx);
  const all = paragraphs(doc);
  const info = classify(all);
  const editable = (id: number) => info[id] !== undefined && !info[id].locked;

  // Inserts first: they only add siblings, so the other paragraphs' elements stay valid.
  const lastInserted = new Map<number, Element>();
  for (const { afterId, text } of edits.insertAfter) {
    if (!editable(afterId) || !text.trim()) continue;
    const anchor = lastInserted.get(afterId) ?? all[afterId].el;
    const clone = cloneWithText(all[afterId].el, text);
    anchor.parentNode?.insertBefore(clone, anchor.nextSibling);
    lastInserted.set(afterId, clone);
  }
  for (const { id, text } of edits.rewrite) {
    if (editable(id) && text.trim() && text !== all[id].text) editParagraph(all[id], text);
  }
  for (const id of edits.remove) {
    if (editable(id)) all[id].el.parentNode?.removeChild(all[id].el);
  }

  const xml = new XMLSerializer().serializeToString(doc);
  zip.file(DOCUMENT_PATH, xml.startsWith("<?xml") ? xml : declaration + xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const DATE_RANGE =
  /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:19|20)\d{2}\b/i;
const CONTACT = /@|https?:\/\/|linkedin|github\.com|\+?\d[\d\s().-]{7,}\d/i;

function classify(all: Paragraph[]): DocParagraph[] {
  const flat = (p: Paragraph) => p.text.replace(/\s+/g, " ").trim();
  const isHeading = (p: Paragraph) => {
    const t = flat(p);
    if (!t || t.length >= 60) return false;
    return (
      (OTHER_HEADING.test(t) && !/:\s*\S/.test(t)) ||
      isHeadingLike(t) ||
      (SKILLS_HEADING.test(t) && !t.match(SKILLS_HEADING)?.[1]?.trim()) ||
      hasHeadingStyle(p.el) ||
      (isAllBold(p) && !t.endsWith("."))
    );
  };
  const firstText = all.findIndex((p) => flat(p));

  return all.map((p, id) => {
    const t = flat(p);
    const bullet = isBullet(p, t);
    const locked =
      !t ||
      id === firstText || // the name
      isHeading(p) ||
      (CONTACT.test(t) && t.length < 200) ||
      (DATE_RANGE.test(t) && t.length < 140) ||
      // Job, school and certification lines: facts like titles, employers and years stay as they are.
      (!bullet && t.length < 140 && /\b(?:19|20)\d{2}\b/.test(t)) ||
      (!bullet && isRoleHeader(p, t));
    return { id, text: p.text, locked };
  });
}

/** "Help Desk Analyst | Acme Corp" or a line starting with a bold job title (but not "Label: items"). */
function isRoleHeader(p: Paragraph, t: string) {
  if (t.length >= 120 || /[.!?]$/.test(t)) return false;
  if (/\s[|•·]\s/.test(t)) return true;
  const first = p.pieces.find((piece) => piece.text.trim());
  return first !== undefined && isBoldRun(first) && !/^[^:]{1,40}:/.test(t);
}

function isBullet(p: Paragraph, t: string) {
  return p.el.getElementsByTagNameNS(W, "numPr").length > 0 || /^[•\-–▪●◦*]\s/.test(t);
}

function hasHeadingStyle(p: Element) {
  const styles = p.getElementsByTagNameNS(W, "pStyle");
  return styles.length > 0 && /heading|title/i.test(styles[0].getAttributeNS(W, "val") ?? "");
}

/** Every visible character is in a bold run: job titles and company lines in most templates. */
function isAllBold(p: Paragraph) {
  const textPieces = p.pieces.filter((piece) => piece.text.trim() && piece.text !== "\n" && piece.text !== "\t");
  return textPieces.length > 0 && textPieces.every(isBoldRun);
}

function isBoldRun(piece: Piece) {
  const run = piece.node.parentNode as Element | null;
  const bold = run?.getElementsByTagNameNS(W, "b")[0];
  const val = bold?.getAttributeNS(W, "val");
  return bold !== undefined && val !== "0" && val !== "false";
}

async function load(docx: Buffer) {
  const zip = await JSZip.loadAsync(docx);
  const file = zip.file(DOCUMENT_PATH);
  if (!file) throw new Error("Not a Word document");
  const xml = await file.async("string");
  const declaration = xml.match(/^<\?xml[^>]*\?>/)?.[0] ?? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return { zip, doc, declaration };
}

/** Body paragraphs in reading order, skipping the duplicate copies Word keeps for older readers. */
function paragraphs(doc: Document): Paragraph[] {
  const result: Paragraph[] = [];
  const all = doc.getElementsByTagNameNS(W, "p");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (hasAncestor(el, "Fallback")) continue;
    const pieces = collectPieces(el);
    result.push({ el, pieces, text: pieces.map((p) => p.text).join("") });
  }
  return result;
}

function hasAncestor(node: Node, localName: string) {
  for (let n = node.parentNode; n; n = n.parentNode) if ((n as Element).localName === localName) return true;
  return false;
}

/** Text pieces that belong to this paragraph (not to text boxes nested inside it). */
function collectPieces(el: Element, out: Piece[] = []): Piece[] {
  for (let child = el.firstChild; child; child = child.nextSibling) {
    if (child.nodeType !== 1) continue;
    const c = child as Element;
    const name = c.localName;
    if (["p", "txbxContent", "del", "Fallback", "pPr", "rPr", "instrText"].includes(name ?? "")) continue;
    if (c.namespaceURI === W && name === "t") out.push({ node: c, text: c.textContent ?? "" });
    else if (c.namespaceURI === W && (name === "br" || name === "cr")) {
      const type = c.getAttributeNS(W, "type");
      if (!type || type === "textWrapping") out.push({ node: c, text: "\n" });
    } else if (c.namespaceURI === W && name === "tab" && (c.parentNode as Element)?.localName === "r") {
      out.push({ node: c, text: "\t" });
    } else collectPieces(c, out);
  }
  return out;
}

function findSection(all: Paragraph[]): Paragraph[] | null {
  const flat = (p: Paragraph) => p.text.replace(/\s+/g, " ").trim();
  const start = all.findIndex((p) => SKILLS_HEADING.test(flat(p)) && p.text.length < 400);
  if (start === -1) return null;

  // "Skills: React, Node" on the heading line itself is the whole section.
  const inline = flat(all[start]).match(SKILLS_HEADING)?.[1]?.trim();
  const lines: Paragraph[] = inline ? [all[start]] : [];

  for (const p of all.slice(start + 1)) {
    const text = p.text.trim();
    if (!text) continue;
    if (OTHER_HEADING.test(text) && text.length < 40 && !/:\s*\S/.test(text)) break;
    if (isHeadingLike(text)) break;
    lines.push(p);
    if (lines.length >= MAX_SECTION_LINES) break;
  }
  return lines.length ? lines : null;
}

/**
 * Replaces the paragraph's text with the smallest possible edit: the shared start and end
 * are left untouched and new text is inserted into the run next to it, inheriting its style.
 */
function editParagraph(paragraph: Paragraph, next: string) {
  const old = paragraph.text;
  let prefix = 0;
  while (prefix < old.length && prefix < next.length && old[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < old.length - prefix &&
    suffix < next.length - prefix &&
    old[old.length - 1 - suffix] === next[next.length - 1 - suffix]
  )
    suffix++;

  deleteRange(paragraph.pieces, prefix, old.length - suffix);
  const pieces = collectPieces(paragraph.el);
  insertAt(paragraph.el, pieces, prefix, next.slice(prefix, next.length - suffix));
}

function deleteRange(pieces: Piece[], from: number, to: number) {
  let offset = 0;
  for (const piece of pieces) {
    const start = offset;
    const end = offset + piece.text.length;
    offset = end;
    if (end <= from || start >= to) continue;

    if (piece.text === "\n" || piece.text === "\t") {
      piece.node.parentNode?.removeChild(piece.node);
      continue;
    }
    const kept = piece.text.slice(0, Math.max(0, from - start)) + piece.text.slice(Math.max(0, to - start));
    if (kept) setText(piece.node, kept);
    else piece.node.parentNode?.removeChild(piece.node);
  }
}

function insertAt(paragraphEl: Element, pieces: Piece[], position: number, text: string) {
  if (!text) return;
  const doc = paragraphEl.ownerDocument!;
  const nodes = textNodes(doc, text);

  if (pieces.length === 0) {
    const run = doc.createElementNS(W, "w:r");
    for (const n of nodes) run.appendChild(n);
    paragraphEl.appendChild(run);
    return;
  }
  if (position === 0) {
    const first = pieces[0].node;
    for (const n of nodes) first.parentNode!.insertBefore(n, first);
    return;
  }

  // Insert right after the character before `position`, inside its run, so the new text
  // inherits that run's formatting (e.g. appending ", Jamf" after "VPN" stays unbolded).
  let offset = 0;
  for (const piece of pieces) {
    const start = offset;
    const end = (offset += piece.text.length);
    if (!(start < position && position <= end)) continue;

    const parent = piece.node.parentNode!;
    const k = position - start;
    if (k < piece.text.length) {
      const rest = doc.createElementNS(W, "w:t");
      setText(rest, piece.text.slice(k));
      setText(piece.node, piece.text.slice(0, k));
      parent.insertBefore(rest, piece.node.nextSibling);
      for (const n of nodes) parent.insertBefore(n, rest);
    } else {
      const ref = piece.node.nextSibling;
      for (const n of nodes) parent.insertBefore(n, ref);
    }
    return;
  }

  const last = pieces[pieces.length - 1].node;
  const ref = last.nextSibling;
  for (const n of nodes) last.parentNode!.insertBefore(n, ref);
}

/** w:t / w:br / w:tab elements for a string that may contain line breaks and tabs. */
function textNodes(doc: Document, text: string): Element[] {
  const nodes: Element[] = [];
  for (const part of text.split(/(\n|\t)/)) {
    if (!part) continue;
    if (part === "\n") nodes.push(doc.createElementNS(W, "w:br"));
    else if (part === "\t") nodes.push(doc.createElementNS(W, "w:tab"));
    else {
      const t = doc.createElementNS(W, "w:t");
      setText(t, part);
      nodes.push(t);
    }
  }
  return nodes;
}

function setText(t: Element, text: string) {
  while (t.firstChild) t.removeChild(t.firstChild);
  t.appendChild(t.ownerDocument!.createTextNode(text));
  t.setAttributeNS(XML, "xml:space", "preserve");
}

/** A copy of a section paragraph (bullet, indent, font) holding new text in its last run's style. */
function cloneWithText(template: Element, text: string): Element {
  const clone = template.cloneNode(true) as Element;
  const pieces = collectPieces(clone);
  // The last run with visible text carries the line's body style (not a trailing empty run).
  const keep = [...pieces].reverse().find((p) => p.text.trim() && p.text !== "\n" && p.text !== "\t");
  for (const p of pieces) if (p !== keep) p.node.parentNode?.removeChild(p.node);

  if (!keep) {
    insertAt(clone, [], 0, text);
    return clone;
  }
  const parent = keep.node.parentNode!;
  for (const n of textNodes(clone.ownerDocument!, text)) parent.insertBefore(n, keep.node);
  parent.removeChild(keep.node);
  return clone;
}

/** No Skills section: add the lines at the end, styled like the last body paragraph with text. */
function appendParagraphs(doc: Document, all: Paragraph[], lines: string[]) {
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body || lines.length === 0) return;
  const template = [...all].reverse().find((p) => p.el.parentNode === body && p.text.trim());
  const sectPr = [...childElements(body)].reverse().find((c) => c.localName === "sectPr") ?? null;

  for (const line of lines) {
    const para = template ? cloneWithText(template.el, line) : doc.createElementNS(W, "w:p");
    if (!template) insertAt(para, [], 0, line);
    body.insertBefore(para, sectPr);
  }
}

function childElements(el: Element): Element[] {
  const out: Element[] = [];
  for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) out.push(c as Element);
  return out;
}
