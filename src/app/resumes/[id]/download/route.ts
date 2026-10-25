import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DOCX_MIME } from "@/lib/ingest/resume";
import { resumeLabel } from "@/lib/resume/label";

const EXTENSIONS: Record<string, string> = { [DOCX_MIME]: ".docx", "application/pdf": ".pdf", "text/plain": ".txt" };

export async function GET(_request: Request, { params }: RouteContext<"/resumes/[id]/download">) {
  const { id } = await params;
  const user = await requireUser();
  const resume = await db.resume.findFirst({
    where: { id, userId: user.id },
    select: { label: true, fileName: true, file: true, mimeType: true },
  });
  if (!resume?.file || !resume.mimeType) return new Response("Not found", { status: 404 });

  const fileName = `${resumeLabel(resume).replace(/[\\/:*?"<>|]+/g, "-")}${EXTENSIONS[resume.mimeType] ?? ""}`;
  return new Response(new Blob([resume.file], { type: resume.mimeType }), {
    headers: {
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "private, no-store",
    },
  });
}
