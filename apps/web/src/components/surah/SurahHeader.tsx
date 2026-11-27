import { useTranslations } from "next-intl";
import { ArabicText } from "@/components/text/ArabicText";
import type { Locale } from "@/i18n/locale";
import type { Surah } from "@/lib/domain/content";
import type { SurahLink } from "@/lib/services/surah-list";
import type { ItemView } from "@/lib/services/reading/surah-view";
import { LocalizedText } from "./LocalizedText";
import { SourceChips } from "./SourceLink";
import { SurahPager } from "./SurahPager";
import { SurahSwitcher } from "./SurahSwitcher";

type SurahHeaderProps = {
  surah: Surah;
  /** How many verses the page shows: fewer than the surah's when it holds only some (ADR 0022). */
  shownVerseCount: number;
  brief: ItemView[] | null;
  locale: Locale;
  /** Every surah on the site, for the switcher; empty when they couldn't be loaded. */
  surahs: SurahLink[];
  /** The surahs before and after this one in that list. */
  neighbours: { previous: SurahLink | null; next: SurahLink | null };
};

/**
 * The surah's names, where it was revealed, its length, how many of its verses the page shows
 * when that is only some, and its brief once published. Above them, the button that opens the
 * list of surahs; below, links to the surahs before and after.
 */
export function SurahHeader({
  surah,
  shownVerseCount,
  brief,
  locale,
  surahs,
  neighbours,
}: SurahHeaderProps) {
  const t = useTranslations("surah");
  const localName = locale === "ko" ? surah.nameKo : surah.nameEn;
  const numberTitle = t("title", { number: surah.number });
  // On Korean pages the English name follows, as the design shows ("알파티하 Al-Fatiha"). Until a
  // surah has a Korean name, the title is its number and the English name still follows
  // ("수라 2 Al-Baqara", ADR 0025).
  const secondName = locale === "ko" ? surah.nameEn : null;

  return (
    <header className="rounded-xl border border-line bg-white p-6">
      {/* The switcher's panel opens against this row, so it is as wide as the header at most. */}
      <div className="relative flex items-center justify-between gap-3">
        {surahs.length > 0 ? <SurahSwitcher surahs={surahs} current={surah.number} /> : null}
        <ArabicText size="lg" className="ml-auto min-w-0 text-brand">
          {surah.nameAr}
        </ArabicText>
      </div>
      <h1 className="mt-1 text-2xl font-semibold">
        {localName ?? numberTitle}
        {secondName ? (
          <span lang="en" className="ml-2 text-lg font-normal text-ink-muted">
            {secondName}
          </span>
        ) : null}
      </h1>
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        {[
          // The number is already the title when the surah has no name in this language.
          ...(localName ? [numberTitle] : []),
          t(surah.revelationPlace),
          t("verseCount", { count: surah.verseCount }),
        ].map((chip) => (
          <li key={chip} className="rounded-full bg-page px-3 py-0.5">
            {chip}
          </li>
        ))}
      </ul>
      {shownVerseCount < surah.verseCount ? (
        <p className="mt-3 text-sm text-ink-muted">
          {t("showingVerses", { shown: shownVerseCount, total: surah.verseCount })}
        </p>
      ) : null}
      {brief && brief.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 text-ink-muted">
          {brief.map((paragraph, i) => (
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
      <SurahPager
        previous={neighbours.previous}
        next={neighbours.next}
        label={t("pager.label")}
        className="mt-5 border-t border-line pt-4"
      />
    </header>
  );
}
