import { useTranslations } from "next-intl";
import { ArabicText } from "@/components/text/ArabicText";
import type { Locale } from "@/i18n/locale";
import type { Surah } from "@/lib/domain/content";
import type { ItemView } from "@/lib/services/reading/surah-view";
import { DraftBadge } from "./DraftBadge";
import { LocalizedText } from "./LocalizedText";
import { SourceChips } from "./SourceLink";

type SurahHeaderProps = {
  surah: Surah;
  brief: { draft: boolean; items: ItemView[] } | null;
  locale: Locale;
};

/** The surah's names, where it was revealed, its length, and its brief once published. */
export function SurahHeader({ surah, brief, locale }: SurahHeaderProps) {
  const t = useTranslations("surah");
  const localName = locale === "ko" ? surah.nameKo : surah.nameEn;
  // On Korean pages the English name follows, as the design shows ("알파티하 Al-Fatiha").
  const secondName = locale === "ko" ? surah.nameEn : null;

  return (
    <header className="rounded-xl border border-line bg-white p-6">
      <ArabicText size="lg" className="text-brand">
        {surah.nameAr}
      </ArabicText>
      <h1 className="mt-1 text-2xl font-semibold">
        {localName ?? t("title", { number: surah.number })}
        {localName && secondName ? (
          <span lang="en" className="ml-2 text-lg font-normal text-ink-muted">
            {secondName}
          </span>
        ) : null}
      </h1>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {[
          t("title", { number: surah.number }),
          t(surah.revelationPlace),
          t("verseCount", { count: surah.verseCount }),
        ].map((chip) => (
          <li key={chip} className="rounded-full bg-page px-3 py-0.5">
            {chip}
          </li>
        ))}
      </ul>
      {brief && brief.items.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 text-ink-muted">
          {brief.draft ? (
            <p>
              <DraftBadge />
            </p>
          ) : null}
          {brief.items.map((paragraph, i) => (
            <div key={i}>
              <LocalizedText
                text={paragraph.text}
                locale={locale}
                trailing={<SourceChips sources={paragraph.sources} />}
              />
            </div>
          ))}
        </div>
      ) : null}
    </header>
  );
}
