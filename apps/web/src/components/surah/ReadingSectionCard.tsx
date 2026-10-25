import { useTranslations } from "next-intl";
import { PlayIcon } from "@/components/icons";
import type { Locale } from "@/i18n/locale";
import type { SectionView } from "@/lib/services/reading/surah-view";
import { ExplanationParts } from "./ExplanationParts";
import { QaPanel } from "./QaPanel";
import { SectionFrame } from "./SectionFrame";
import { SectionVerses } from "./SectionVerses";

type ReadingSectionCardProps = { section: SectionView; locale: Locale };

/** One reading section: its verses, then its explanation, or a note that it is coming soon. */
export function ReadingSectionCard({ section, locale }: ReadingSectionCardProps) {
  const t = useTranslations("surah");
  const { position, total, explanation } = section;

  return (
    <SectionFrame position={position} anchor={section.anchor} label={section.label}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-brand">{section.label}</h2>
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
          <span className="hidden sm:inline">{t("sectionOf", { position, total })}</span>
          <span className="sm:hidden">{t("sectionOfShort", { position, total })}</span>
        </div>
      </div>

      <SectionVerses verses={section.verses} words={section.words} />

      {explanation ? (
        <>
          <div className="mt-6 border-t border-line pt-5">
            <ExplanationParts explanation={explanation} locale={locale} />
          </div>
          {/* On phones the questions sit under each section instead of in a side panel. */}
          <div className="mt-6 lg:hidden">
            <QaPanel variant="inline" />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-dashed border-line bg-page p-4">
          <h3 className="font-semibold">{t("comingSoonTitle")}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t("comingSoonBody")}</p>
        </div>
      )}
    </SectionFrame>
  );
}
