"use client";

import { useCallback, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { useDismiss } from "@/components/use-dismiss";

type MobileMenuProps = { openLabel: string; closeLabel: string; children: ReactNode };

/**
 * The top bar's menu button on phones. It shows `children` (navigation, language, account) in a
 * panel below the bar. Escape, a press outside, or following a link closes it.
 */
export function MobileMenu({ openLabel, closeLabel, children }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = useCallback((reason: "escape" | "outside" | "link") => {
    setOpen(false);
    if (reason === "escape") {
      button.current?.focus();
    }
  }, []);
  useDismiss(open, close, container);

  function onPanelClick(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) {
      close("link");
    }
  }

  return (
    <div ref={container}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? closeLabel : openLabel}
        onClick={() => setOpen((value) => !value)}
        className="rounded-md p-2 text-ink hover:bg-page"
      >
        {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>
      {/* Kept in the page while closed, so the session-dependent parts don't load again. */}
      <div
        id={panelId}
        hidden={!open}
        onClick={onPanelClick}
        className="absolute inset-x-0 top-full z-30 border-b border-line bg-white px-4 py-4 shadow-sm"
      >
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
