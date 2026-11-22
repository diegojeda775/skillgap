import type { Document, Element } from "@xmldom/xmldom";
import JSZip from "jszip";
import {
  childElements,
  classify,
  CONTACT,
  hasHeadingStyle,
  isBullet,
  load,
  type Paragraph,
  paragraphs,
  save,
  setHeadline,
  textNodes,
  W,
} from "@/lib/resume/docx";
import { isHeadingLike, OTHER_HEADING, SKILLS_HEADING } from "@/lib/resume/skills";

// A cover letter in the resume's own design: its name and contact lines stay as the letterhead,
// the rest is replaced by the letter in the resume's body font.

const MAX_LETTERHEAD_LINES = 6;

/** `resume` is the .docx to take the letterhead from; without one the letter is plain. */
export async function letterDocx(body: string, resume: Buffer | null, headline: string): Promise<Buffer> {
  const { zip, doc, declaration } = await load(resume ?? (await blankDocx()));
  const bodyEl = doc.getElementsByTagNameNS(W, "body")[0];
  if (!bodyEl) throw new Error("Not a Word document");

  const all = paragraphs(doc);
  const info = classify(all);
  const letterheadEnd = findLetterheadEnd(all, info);
  const style = bodyStyle(all.slice(Math.max(letterheadEnd, 0)));
  if (letterheadEnd > 0) setHeadline(all, info, headline);

  const children = childElements(bodyEl);
  const end = letterheadEnd > 0 ? topLevel(all[letterheadEnd].el, bodyEl) : children[0];
  // A letterhead that shares a table or text box with the rest of the resume can't be split off.
  const shared = letterheadEnd > 0 && all.slice(0, letterheadEnd).some((p) => topLevel(p.el, bodyEl) === end);
  const from = shared ? 0 : Math.max(0, children.indexOf(end));
  const last = children[children.length - 1];
  const sectPr = last?.localName === "sectPr" ? last : null;
  for (const child of children.slice(from)) if (child !== sectPr) bodyEl.removeChild(child);
  // The resume may be laid out in columns; a letter isn't.
  const cols = sectPr && childElements(sectPr).find((c) => c.localName === "cols");
  if (cols) sectPr.removeChild(cols);

  if (from === 0) {
    // No letterhead: the resume's tight margins would leave the letter jammed against the edges.
    style.indent = null;
    const margins = sectPr && childElements(sectPr).find((c) => c.localName === "pgMar");
    for (const side of ["top", "right", "bottom", "left"]) margins?.setAttributeNS(W, `w:${side}`, "1440");
  }

  const blocks = body
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  blocks.forEach((block, i) => {
    bodyEl.insertBefore(letterParagraph(doc, block, style, i === 0 && from > 0), sectPr);
  });
  return save({ zip, doc, declaration });
}

/** Index of the first paragraph after the name and contact lines, or -1 if there's no clear letterhead. */
function findLetterheadEnd(all: Paragraph[], info: ReturnType<typeof classify>) {
  const flat = (p: Paragraph) => p.text.replace(/\s+/g, " ").trim();
  const isSection = (p: Paragraph) => {
    const t = flat(p);
    return OTHER_HEADING.test(t) || SKILLS_HEADING.test(t) || isHeadingLike(t);
  };
  const name = all.findIndex((p) => flat(p));
  if (name === -1 || OTHER_HEADING.test(flat(all[name])) || SKILLS_HEADING.test(flat(all[name]))) return -1;

  const end = all.findIndex((p, i) => {
    const t = flat(p);
    if (i <= name || !t || info[i].headline) return false;
    if (t.length > 200) return true;
    return !CONTACT.test(t) && (isSection(p) || hasHeadingStyle(p.el));
  });
  if (end === -1) return -1;
  return all.slice(0, end).filter((p) => flat(p)).length <= MAX_LETTERHEAD_LINES ? end : -1;
}

function topLevel(el: Element, body: Element): Element {
  let node = el;
  while (node.parentNode && node.parentNode !== body) node = node.parentNode as Element;
  return node;
}

interface BodyStyle {
  /** Font and size elements of the resume's body text. */
  run: Element[];
  indent: Element | null;
}

/** The look of the resume's longest plain paragraph, usually its summary. */
function bodyStyle(all: Paragraph[]): BodyStyle {
  const byLength = [...all].sort((a, b) => b.text.length - a.text.length);
  const plain = byLength.find((p) => p.text.length > 100 && !isBullet(p, p.text.trim()));
  const template = plain ?? byLength[0];
  const piece = template?.pieces.find((p) => p.text.trim());
  if (!piece) return { run: [], indent: null };

  const rPr = childElements(piece.node.parentNode as Element).find((c) => c.localName === "rPr");
  const pPr = plain && childElements(plain.el).find((c) => c.localName === "pPr");
  return {
    run: rPr ? childElements(rPr).filter((c) => ["rFonts", "sz", "szCs"].includes(c.localName ?? "")) : [],
    indent: (pPr && childElements(pPr).find((c) => c.localName === "ind")) || null,
  };
}

function letterParagraph(doc: Document, text: string, style: BodyStyle, spaceAbove: boolean): Element {
  const p = doc.createElementNS(W, "w:p");
  const pPr = doc.createElementNS(W, "w:pPr");
  const spacing = doc.createElementNS(W, "w:spacing");
  spacing.setAttributeNS(W, "w:before", spaceAbove ? "360" : "0");
  spacing.setAttributeNS(W, "w:after", "200");
  spacing.setAttributeNS(W, "w:line", "276");
  spacing.setAttributeNS(W, "w:lineRule", "auto");
  pPr.appendChild(spacing);
  if (style.indent) {
    const indent = style.indent.cloneNode(true) as Element;
    for (const attr of ["firstLine", "hanging"]) indent.removeAttributeNS(W, attr);
    pPr.appendChild(indent);
  }
  p.appendChild(pPr);

  const run = doc.createElementNS(W, "w:r");
  if (style.run.length) {
    const rPr = doc.createElementNS(W, "w:rPr");
    for (const el of style.run) rPr.appendChild(el.cloneNode(true));
    run.appendChild(rPr);
  }
  for (const node of textNodes(doc, text)) run.appendChild(node);
  p.appendChild(run);
  return p;
}

/** An empty letter-size document in 11pt Calibri, for resumes that aren't Word files. */
async function blankDocx(): Promise<Buffer> {
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const pkg = "http://schemas.openxmlformats.org/package/2006";
  const office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const main = "application/vnd.openxmlformats-officedocument.wordprocessingml";
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `${declaration}<Types xmlns="${pkg}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="${main}.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="${main}.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `${declaration}<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${office}/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `${declaration}<Relationships xmlns="${pkg}/relationships"><Relationship Id="rId1" Type="${office}/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `${declaration}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `${declaration}<w:document xmlns:w="${W}"><w:body><w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
