"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { useReader } from "./SurahReader";

type QaPanelProps =
  /** The right column on wide screens, following the section in view. */
  | { variant: "panel"; sectionLabels: Record<number, string> }
  /** Under a section, on phones. */
  | { variant: "inline" };

/**
 * Questions and answers. The fixed questions and their prepared answers arrive with #5; until
 * then the list is empty. Asking your own question is shown, disabled, as coming soon.
 */
export function QaPanel(props: QaPanelProps) {
  const t = useTranslations("qa");
  const { currentSection } = useReader();
  const headingId = useId();
  const inputId = useId();
  const range = props.variant === "panel" ? props.sectionLabels[currentSection] : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className={
        props.variant === "panel"
          ? "rounded-xl border border-line bg-white p-5"
          : "border-t border-line pt-5"
      }
    >
      <h2 id={headingId} className="font-semibold">
        {t("title")}
      </h2>
      {range ? <p className="mt-0.5 text-xs text-ink-muted">{t("readingNow", { range })}</p> : null}
      {/* Fixed questions (#5) go here. */}
      <label htmlFor={inputId} className="mt-5 mb-1 block text-xs font-semibold">
        {t("askLabel")}
      </label>
      <input
        id={inputId}
        type="text"
        disabled
        placeholder={t("askPlaceholder")}
        className="w-full cursor-not-allowed rounded-md border border-line bg-page px-3 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-ink-muted">{t("declineNote")}</p>
    </section>
  );
}
