import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { UserInputError } from "@/lib/errors";
import { htmlToText } from "./html";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_CHARS = 40_000;

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface ResumeFile {
  text: string;
  buffer: Buffer;
  mimeType: string;
}

/** Reads an uploaded PDF, DOCX or TXT resume: its text plus the original bytes. */
export async function readResumeFile(file: File): Promise<ResumeFile> {
  if (file.size > MAX_RESUME_BYTES) throw new UserInputError("Resume must be 5 MB or smaller.");

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let mimeType: string;

  if (name.endsWith(".pdf")) mimeType = "application/pdf";
  else if (name.endsWith(".docx")) mimeType = DOCX_MIME;
  else if (name.endsWith(".txt") || name.endsWith(".md")) mimeType = "text/plain";
  else throw new UserInputError("Upload a PDF, DOCX or TXT resume.");

  const text = await resumeText(buffer, mimeType);
  if (text.length < 200) {
    throw new UserInputError("Couldn't read text from that resume. If it's a scanned PDF, upload a text-based PDF or DOCX.");
  }
  return { text, buffer, mimeType };
}

export async function resumeText(buffer: Buffer, mimeType: string): Promise<string> {
  let text: string;
  if (mimeType === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (mimeType === DOCX_MIME) {
    // HTML keeps line breaks inside paragraphs; mammoth's raw text mode glues those lines together.
    text = htmlToText((await mammoth.convertToHtml({ buffer })).value);
  } else {
    text = buffer.toString("utf8");
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_RESUME_CHARS);
}
