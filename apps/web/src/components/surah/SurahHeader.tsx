import { useTranslations } from "next-intl";
import { ArabicText } from "@/components/text/ArabicText";
import type { Locale } from "@/i18n/locale";
import type { Localized, Surah } from "@/lib/domain/content";
import { LocalizedText } from "./LocalizedText";

type SurahHeaderProps = { surah: Surah; brief: Localized | null; locale: Locale };

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
      {brief ? (
        <div className="mt-4 text-ink-muted">
          <LocalizedText text={brief} locale={locale} />
        </div>
      ) : null}
    </header>
  );
}
