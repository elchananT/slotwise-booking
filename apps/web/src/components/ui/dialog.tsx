"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Native <dialog>: focus trap, Esc to close and inert background come for free. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn("sheet", wide && "!max-w-[min(56rem,calc(100vw-1.5rem))]")}
      aria-labelledby="dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2 sm:px-8 sm:pt-8">
            <div>
              <h2 id="dlg-title" className="text-2xl">
                {title}
              </h2>
              {description && <p className="mt-1 text-ink-2">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="scroll-thin overflow-y-auto px-6 pt-3 pb-6 sm:px-8 sm:pb-8">{children}</div>
        </div>
      )}
    </dialog>
  );
}
