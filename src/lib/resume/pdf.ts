import "server-only";

const TIMEOUT_MS = 60_000;

export class PdfConversionError extends Error {}

/**
 * Converts a .docx to PDF with LibreOffice running in Gotenberg (see docker-compose.yml),
 * which lays the document out the way Word does instead of re-rendering it as HTML.
 */
export async function docxToPdf(docx: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const base = process.env.GOTENBERG_URL;
  if (!base) throw new PdfConversionError("PDF export isn't set up: GOTENBERG_URL is missing.");

  const form = new FormData();
  form.append("files", new Blob([docx]), "resume.docx");

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/forms/libreoffice/convert`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new PdfConversionError(`The PDF converter isn't reachable at ${base}.`, { cause: error });
  }
  if (!res.ok) throw new PdfConversionError(`The PDF converter failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return new Uint8Array(await res.arrayBuffer());
}
