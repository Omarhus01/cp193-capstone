import type { Locale } from "@/i18n/locale";
import { getSurahList } from "@/lib/data/content";
import type { SurahListItem } from "@/lib/domain/content";

/** A surah readers can open, as the home page and the surah switcher list it. */
export type SurahLink = {
  number: number;
  /** The name in the page's language, else English, else Arabic. */
  name: string;
  /** The Arabic name, shown beside it. */
  nameAr: string;
  /** The English and Korean names when the surah has them, so a search finds it by either. */
  nameEn: string | null;
  nameKo: string | null;
  /** The verses the surah holds when that is only some, such as "4:34"; null when complete. */
  verses: string | null;
};

/**
 * The verses a surah holds as ranges, such as "4:34", "4:34–35" or "4:34, 4:59–60". Null when
 * it holds every verse, or none.
 */
export function verseRanges(
  surah: number,
  ayahs: readonly number[],
  verseCount: number,
): string | null {
  const sorted = [...new Set(ayahs)].sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length >= verseCount) {
    return null;
  }
  const ranges: [number, number][] = [];
  for (const ayah of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && ayah === last[1] + 1) {
      last[1] = ayah;
    } else {
      ranges.push([ayah, ayah]);
    }
  }
  return ranges
    .map(([from, to]) => (from === to ? `${surah}:${from}` : `${surah}:${from}–${to}`))
    .join(", ");
}

/** The links for these surahs, named in the page's language. */
export function surahLinks(surahs: readonly SurahListItem[], locale: Locale): SurahLink[] {
  return surahs.map((surah) => ({
    number: surah.number,
    name: (locale === "ko" ? surah.nameKo : surah.nameEn) ?? surah.nameEn ?? surah.nameAr,
    nameAr: surah.nameAr,
    nameEn: surah.nameEn,
    nameKo: surah.nameKo,
    verses: verseRanges(surah.number, surah.ayahs, surah.verseCount),
  }));
}

/**
 * Every surah in the database, explained or not (ADR 0025). When they can't be loaded, the error is logged and the
 * list is empty, so the page that shows it still works.
 */
export async function loadSurahLinks(locale: Locale): Promise<SurahLink[]> {
  try {
    return surahLinks(await getSurahList(), locale);
  } catch (error) {
    console.error("Couldn't load the surahs:", error);
    return [];
  }
}
