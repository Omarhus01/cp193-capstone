"use client";

import { useTranslations } from "next-intl";
import { useId, type ChangeEvent } from "react";
import { ArabicText } from "@/components/text/ArabicText";
import type { SectionView } from "@/lib/services/reading/surah-view";
import { useReader } from "./SurahReader";

export type SectionNavItem = Pick<
  SectionView,
  "position" | "kind" | "page" | "anchor" | "label" | "previewAr" | "published"
>;

/**
 * The surah page's sidebar: its reading sections and page blocks, with the one in view
 * highlighted. A list on wide screens, a dropdown on phones. A reading section whose explanation
 * isn't published is marked as in review; page blocks have no explanation yet and no mark.
 */
export function ReadingSectionNav({ sections }: { sections: SectionNavItem[] }) {
  const t = useTranslations("surah");
  const { currentSection, setCurrentSection } = useReader();
  const selectId = useId();
  const labelOf = (section: SectionNavItem) =>
    section.kind === "page" && section.page
      ? t("pageLabel", { page: section.page, range: section.label })
      : section.label;
  const inReview = (section: SectionNavItem) => section.kind === "section" && !section.published;

  function onSelect(event: ChangeEvent<HTMLSelectElement>) {
    const section = sections.find((s) => s.position === Number(event.target.value));
    if (section) {
      setCurrentSection(section.position);
      document.getElementById(section.anchor)?.scrollIntoView();
      history.replaceState(null, "", `#${section.anchor}`);
    }
  }

  return (
    <>
      <nav aria-label={t("readingSections")} className="hidden lg:block">
        <h2 className="mb-2 px-1 text-xs font-semibold text-ink-muted">{t("readingSections")}</h2>
        <ul className="flex flex-col gap-1">
          {sections.map((section) => {
            const current = section.position === currentSection;
            return (
              <li key={section.position}>
                <a
                  href={`#${section.anchor}`}
                  aria-current={current ? "location" : undefined}
                  onClick={() => setCurrentSection(section.position)}
                  className={`block rounded-lg border-l-4 px-3 py-2 ${
                    current ? "border-brand bg-brand-soft" : "border-transparent hover:bg-white"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{labelOf(section)}</span>
                    {inReview(section) ? (
                      <span className="text-xs text-ink-muted">{t("inReview")}</span>
                    ) : null}
                  </span>
                  <ArabicText as="span" size="sm" className="block">
                    {section.previewAr}
                  </ArabicText>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="lg:hidden">
        <label htmlFor={selectId} className="mb-1 block text-xs font-semibold text-ink-muted">
          {t("readingSections")}
        </label>
        <select
          id={selectId}
          value={currentSection}
          onChange={onSelect}
          className="w-full rounded-lg border border-line bg-white px-3 py-2"
        >
          {sections.map((section) => (
            <option key={section.position} value={section.position}>
              {inReview(section) ? `${labelOf(section)} · ${t("inReview")}` : labelOf(section)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
