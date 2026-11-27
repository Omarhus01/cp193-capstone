import { useTranslations } from "next-intl";
import { PlayIcon } from "@/components/icons";
import type { Locale } from "@/i18n/locale";
import type { QuestionView } from "@/lib/services/qa";
import type { SectionView } from "@/lib/services/reading/surah-view";
import { ExplanationParts } from "./ExplanationParts";
import { QaPanel } from "./QaPanel";
import { SectionFrame } from "./SectionFrame";
import { SectionVerses } from "./SectionVerses";

type ReadingSectionCardProps = { section: SectionView; questions: QuestionView[]; locale: Locale };

/**
 * One block of the surah page. A reading section shows its verses, then its explanation or a note
 * that it is coming soon, and on phones its questions. A page block holds verses no section covers
 * yet, from one page of the mushaf, with a one-line coming-soon note (ADR 0025).
 */
export function ReadingSectionCard({ section, questions, locale }: ReadingSectionCardProps) {
  const t = useTranslations("surah");
  const { explanation, sectionOf } = section;
  const label =
    section.kind === "page" && section.page
      ? t("pageLabel", { page: section.page, range: section.label })
      : section.label;

  return (
    <SectionFrame position={section.position} anchor={section.anchor} label={label}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand">{label}</h2>
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          {/* Recitation audio comes with its own issue. */}
          <button
            type="button"
            disabled
            title={t("listenComingSoon")}
            className="flex cursor-not-allowed items-center gap-1 rounded-full border border-line px-3 py-1 text-brand opacity-70"
          >
            <PlayIcon className="size-3" />
            {t("listen")}
            <span className="sr-only">({t("listenComingSoon")})</span>
          </button>
          {sectionOf ? (
            <>
              <span className="hidden sm:inline">
                {t("sectionOf", { position: sectionOf.number, total: sectionOf.total })}
              </span>
              <span className="sm:hidden">
                {t("sectionOfShort", { position: sectionOf.number, total: sectionOf.total })}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <SectionVerses verses={section.verses} words={section.words} />

      {explanation ? (
        <div className="mt-6 border-t border-line pt-5">
          <ExplanationParts explanation={explanation} locale={locale} />
        </div>
      ) : section.kind === "page" ? (
        <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
          {t("comingSoonLine")}
        </p>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-page p-4">
          <h3 className="font-semibold">{t("comingSoonTitle")}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t("comingSoonBody")}</p>
        </div>
      )}
      {/* On phones the questions sit under each section instead of in a side panel. */}
      {explanation || questions.length > 0 ? (
        <div className="mt-6 lg:hidden">
          <QaPanel variant="inline" questions={questions} />
        </div>
      ) : null}
    </SectionFrame>
  );
}
