/** Display name for a resume version: its label, or the file name without the extension. */
export function resumeLabel(resume: { label: string | null; fileName: string }) {
  return resume.label?.trim() || resume.fileName.replace(/\.(pdf|docx|txt|md)$/i, "");
}
