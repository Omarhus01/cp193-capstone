"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "@/components/use-dismiss";

type AccountMenuProps = { label: string; children: ReactNode };

/** The "Account" button of a logged-in user, which opens the account actions (Log out). */
export function AccountMenu({ label, children }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((reason: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") {
      button.current?.focus();
    }
  }, []);
  useDismiss(open, close, container);

  return (
    <div ref={container} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-page"
      >
        {label}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 z-30 mt-2 min-w-40 rounded-md border border-line bg-white p-3 shadow-md"
      >
        {children}
      </div>
    </div>
  );
}
