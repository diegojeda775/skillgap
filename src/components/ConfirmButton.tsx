"use client";

import { type ComponentProps, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog } from "./Dialog";
import { secondaryButton } from "./ui";

interface Props extends Omit<ComponentProps<"button">, "type" | "onClick"> {
  message: string;
  /** Label of the confirm button in the dialog, e.g. "Delete". */
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * A button that asks for confirmation in an in-app dialog, then submits its form.
 * Native confirm() is avoided: some browsers and embedded views block it, which
 * silently cancels the action.
 */
export function ConfirmButton({ message, confirmLabel = "Confirm", destructive = true, children, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { pending } = useFormStatus();

  return (
    <>
      <button ref={triggerRef} type="button" disabled={pending || props.disabled} onClick={() => setOpen(true)} {...props}>
        {pending ? "Working…" : children}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={message}>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setOpen(false);
              triggerRef.current?.form?.requestSubmit();
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              destructive ? "bg-rose-600 hover:bg-rose-700" : "bg-neutral-900 hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </Dialog>
    </>
  );
}
