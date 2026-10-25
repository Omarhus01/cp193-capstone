import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locale";
import type { ExplanationView, ItemView, VerseLink } from "@/lib/services/reading/surah-view";
import { LocalizedText } from "./LocalizedText";
import { SourceChips } from "./SourceLink";

type ExplanationPartsProps = { explanation: ExplanationView; locale: Locale };

/**
 * A reading section's explanation: Meaning, Background and Related verses, each a list of points
 * with their own source links (ADR 0015). The word meanings part isn't shown; word meanings are
 * in the word popover.
 */
export function ExplanationParts({ explanation, locale }: ExplanationPartsProps) {
  const t = useTranslations("surah");
  const { meaning, background, relatedVerses, contextLinks } = explanation;

  return (
    <div className="flex flex-col gap-5">
      {meaning.length > 0 ? (
        <Part title={t("meaning")}>
          <Points items={meaning} locale={locale} />
        </Part>
      ) : null}
      {background.length > 0 ? (
        <Part title={t("background")}>
          <Points items={background} locale={locale} />
        </Part>
      ) : null}
      {relatedVerses.length > 0 || contextLinks.length > 0 ? (
        <Part title={t("relatedVerses")}>
          <ul className="flex flex-col gap-2">
            {relatedVerses.map((related) => (
              <li key={related.verse.label}>
                <LocalizedText
                  text={related.text}
                  locale={locale}
                  trailing={<SourceChips sources={related.sources} />}
                  lead={
                    <>
                      <VerseReference verse={related.verse} />:{" "}
                    </>
                  }
                />
              </li>
            ))}
            {contextLinks.map((link) => (
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
        </Part>
      ) : null}
    </div>
  );
}

/** "27:30:" before a related verse's reason: a link once that verse is imported. */
function VerseReference({ verse }: { verse: VerseLink }) {
  const t = useTranslations("surah");
  return verse.available ? (
    <Link
      href={`/surah/${verse.surah}#${verse.anchor}`}
      aria-label={`${verse.label} ${t("seeVerse")}`}
      className="font-semibold text-brand underline underline-offset-2"
    >
      {verse.label}
    </Link>
  ) : (
    <span className="font-semibold">{verse.label}</span>
  );
}

function Points({ items, locale }: { items: ItemView[]; locale: Locale }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-line">
      {items.map((item, i) => (
        <li key={i}>
          <LocalizedText
            text={item.text}
            locale={locale}
            trailing={<SourceChips sources={item.sources} />}
          />
        </li>
      ))}
    </ul>
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
