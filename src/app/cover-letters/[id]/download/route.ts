import { requireUser } from "@/lib/auth";
import { letterDocx } from "@/lib/cover-letter/docx";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { docxToPdf, PdfConversionError } from "@/lib/resume/pdf";
import { headlineTitle } from "@/lib/tailor/headline";

/** Downloads a cover letter as Word, or as PDF with `?format=pdf`. */
export async function GET(request: Request, { params }: RouteContext<"/cover-letters/[id]/download">) {
  const { id } = await params;
  const user = await requireUser();
  const letter = await db.coverLetter.findFirst({
    where: { id, userId: user.id, status: "COMPLETE" },
    include: {
      job: { select: { title: true, company: true } },
      resume: { select: { file: true, mimeType: true } },
    },
  });
  if (!letter) return new Response("Not found", { status: 404 });

  // The letterhead comes from the resume it was written from, or the master if that was deleted or isn't Word.
  let source = letter.resume;
  if (!source?.file || source.mimeType !== DOCX_MIME) {
    source = await db.resume.findFirst({
      where: { userId: user.id, isMaster: true, mimeType: DOCX_MIME },
      select: { file: true, mimeType: true },
    });
  }

  let body: Uint8Array<ArrayBuffer> = new Uint8Array(
    await letterDocx(letter.body, source?.file ? Buffer.from(source.file) : null, headlineTitle(letter.job.title)),
  );
  let mimeType = DOCX_MIME;
  let extension = ".docx";
  if (new URL(request.url).searchParams.get("format") === "pdf") {
    try {
      body = await docxToPdf(body);
      mimeType = "application/pdf";
      extension = ".pdf";
    } catch (error) {
      if (!(error instanceof PdfConversionError)) throw error;
      console.error(error);
      return new Response(`${error.message} Try again in a moment, or download the Word file.`, { status: 503 });
    }
  }

  const name = ["Cover Letter", letter.job.title, letter.job.company].filter(Boolean).join(" – ");
  return new Response(new Blob([body], { type: mimeType }), {
    headers: {
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name.replace(/[\\/:*?"<>|]+/g, "-") + extension)}`,
      "cache-control": "private, no-store",
    },
  });
}
