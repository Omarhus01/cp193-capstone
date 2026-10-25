"use client";

import { useEffect, type RefObject } from "react";

/**
 * Calls `onDismiss` while `open` when the user presses Escape or presses the pointer outside
 * `container`. Used by menus and popovers.
 */
export function useDismiss(
  open: boolean,
  onDismiss: (reason: "escape" | "outside") => void,
  container: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onDismiss("escape");
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (container.current && !container.current.contains(event.target as Node)) {
        onDismiss("outside");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, onDismiss, container]);
}
