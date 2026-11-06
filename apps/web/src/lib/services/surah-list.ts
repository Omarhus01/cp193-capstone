import type { Locale } from "@/i18n/locale";
import { getPublishedSurahs } from "@/lib/data/content";
import type { PublishedSurah } from "@/lib/domain/content";

/** A surah readers can open, as the home page lists it. */
export type SurahLink = {
  number: number;
  /** The name in the page's language, else English, else Arabic. */
  name: string;
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
export function surahLinks(surahs: readonly PublishedSurah[], locale: Locale): SurahLink[] {
  return surahs.map((surah) => ({
    number: surah.number,
    name: (locale === "ko" ? surah.nameKo : surah.nameEn) ?? surah.nameEn ?? surah.nameAr,
    verses: verseRanges(surah.number, surah.ayahs, surah.verseCount),
  }));
}

/**
 * Every surah with published explanations. When they can't be loaded, the error is logged and the
 * list is empty, so the page that shows it still works.
 */
export async function loadSurahLinks(locale: Locale): Promise<SurahLink[]> {
  try {
    return surahLinks(await getPublishedSurahs(), locale);
  } catch (error) {
    console.error("Couldn't load the published surahs:", error);
    return [];
  }
}
