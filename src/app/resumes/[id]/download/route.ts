import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { resumeLabel } from "@/lib/resume/label";
import { docxToPdf, PdfConversionError } from "@/lib/resume/pdf";

const PDF_MIME = "application/pdf";
const EXTENSIONS: Record<string, string> = { [DOCX_MIME]: ".docx", [PDF_MIME]: ".pdf", "text/plain": ".txt" };

/** Downloads a resume version as uploaded, or as PDF with `?format=pdf`. */
export async function GET(request: Request, { params }: RouteContext<"/resumes/[id]/download">) {
  const { id } = await params;
  const user = await requireUser();
  const resume = await db.resume.findFirst({
    where: { id, userId: user.id },
    select: { label: true, fileName: true, file: true, mimeType: true },
  });
  if (!resume?.file || !resume.mimeType) return new Response("Not found", { status: 404 });

  let body: Uint8Array<ArrayBuffer> = resume.file;
  let mimeType = resume.mimeType;

  if (new URL(request.url).searchParams.get("format") === "pdf" && mimeType !== PDF_MIME) {
    if (mimeType !== DOCX_MIME) return new Response("Only Word resumes can be converted to PDF.", { status: 400 });
    try {
      body = await docxToPdf(resume.file);
      mimeType = PDF_MIME;
    } catch (error) {
      if (!(error instanceof PdfConversionError)) throw error;
      console.error(error);
      return new Response(`${error.message} Try again in a moment, or download the Word file.`, { status: 503 });
    }
  }

  const name = resumeLabel(resume).replace(/[\\/:*?"<>|]+/g, "-");
  return new Response(new Blob([body], { type: mimeType }), {
    headers: {
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name + (EXTENSIONS[mimeType] ?? ""))}`,
      "cache-control": "private, no-store",
    },
  });
}
