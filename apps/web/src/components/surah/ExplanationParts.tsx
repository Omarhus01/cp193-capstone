import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locale";
import type { ExplanationView } from "@/lib/services/reading/surah-view";
import { LocalizedText } from "./LocalizedText";
import { SourceChip } from "./SourceLink";

type ExplanationPartsProps = { explanation: ExplanationView; locale: Locale };

/**
 * A reading section's explanation: Meaning, Background and Related verses, then its sources.
 * The explanation's word meanings part isn't shown here; word meanings are in the word popover.
 */
export function ExplanationParts({ explanation, locale }: ExplanationPartsProps) {
  const t = useTranslations("surah");
  const { meaning, background, relatedVerses, relatedVerseLinks, citations } = explanation;

  return (
    <div className="flex flex-col gap-5">
      {meaning ? (
        <Part title={t("meaning")}>
          <LocalizedText text={meaning} locale={locale} />
        </Part>
      ) : null}
      {background ? (
        <Part title={t("background")}>
          <LocalizedText text={background} locale={locale} />
        </Part>
      ) : null}
      {relatedVerses || relatedVerseLinks.length > 0 ? (
        <Part title={t("relatedVerses")}>
          {relatedVerses ? <LocalizedText text={relatedVerses} locale={locale} /> : null}
          {relatedVerseLinks.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {relatedVerseLinks.map((link) => (
                <li key={link.label} className="flex flex-wrap items-start gap-3">
                  <Link
                    href={`/surah/${link.surah}#${link.anchor}`}
                    className="shrink-0 rounded-md border border-line px-2 py-0.5 text-sm hover:border-brand"
                  >
                    <span className="font-semibold text-brand">{link.label}</span> {t("seeVerse")}
                  </Link>
                  <div className="min-w-0 flex-1 text-sm">
                    <LocalizedText text={link.reason} locale={locale} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Part>
      ) : null}
      {citations.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">{t("sources")}</span>
          {citations.map(({ number, passage }) => (
            <SourceChip key={passage.id} number={number} passage={passage} />
          ))}
        </p>
      ) : null}
    </div>
  );
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold text-ink-muted">{title}</h3>
      {children}
    </div>
  );
}
