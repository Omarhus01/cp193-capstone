"use client";

import type { ReactNode } from "react";
import { useReader } from "./SurahReader";

type SectionFrameProps = { position: number; anchor: string; label: string; children: ReactNode };

/** A reading section's card, outlined while it is the section in view. */
export function SectionFrame({ position, anchor, label, children }: SectionFrameProps) {
  const { currentSection } = useReader();
  return (
    <section
      id={anchor}
      data-section={position}
      aria-label={label}
      className={`scroll-mt-6 rounded-xl border-2 bg-white p-5 sm:p-6 ${
        position === currentSection ? "border-brand" : "border-transparent ring-1 ring-line"
      }`}
    >
      {children}
    </section>
  );
}
