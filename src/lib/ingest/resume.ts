import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { UserInputError } from "@/lib/errors";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_RESUME_CHARS = 40_000;

/** Extracts plain text from an uploaded PDF, DOCX or TXT resume. */
export async function resumeToText(file: File): Promise<string> {
  if (file.size > MAX_RESUME_BYTES) throw new UserInputError("Resume must be 5 MB or smaller.");

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;

  if (name.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    text = (await extractText(pdf, { mergePages: true })).text;
  } else if (name.endsWith(".docx")) {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (name.endsWith(".txt") || name.endsWith(".md")) {
    text = buffer.toString("utf8");
  } else {
    throw new UserInputError("Upload a PDF, DOCX or TXT resume.");
  }

  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 200) {
    throw new UserInputError("Couldn't read text from that resume. If it's a scanned PDF, upload a text-based PDF or DOCX.");
  }
  return text.slice(0, MAX_RESUME_CHARS);
}
