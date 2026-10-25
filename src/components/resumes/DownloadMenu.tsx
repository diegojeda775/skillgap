"use client";

import { ChevronDown, Download, FileText, FileType } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { primaryButton } from "../ui";

interface Format {
  label: string;
  hint: string;
  href: string;
  icon: typeof FileText;
}

/** "Download" button; with more than one format it opens a menu to pick PDF or Word. */
export function DownloadMenu({ resumeId, isDocx }: { resumeId: string; isDocx: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const base = `/resumes/${resumeId}/download`;
  if (!isDocx) {
    return (
      <a href={base} className={`${primaryButton} flex items-center gap-1.5`}>
        <Download className="size-4" aria-hidden /> Download
      </a>
    );
  }

  const formats: Format[] = [
    { label: "PDF", hint: "Best for applying", href: `${base}?format=pdf`, icon: FileText },
    { label: "Word (.docx)", hint: "To keep editing", href: base, icon: FileType },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${primaryButton} flex h-full items-center gap-1.5`}
      >
        <Download className="size-4" aria-hidden /> Download
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {formats.map(({ label, hint, href, icon: Icon }) => (
            <a
              key={label}
              role="menuitem"
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Icon className="size-4 shrink-0 text-neutral-500" aria-hidden />
              <span>
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-neutral-500">{hint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
