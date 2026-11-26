// Goes through every book of the export for one verse (scripts/find-passages.mts).
import { collectPages, pagesToRead } from "@/lib/services/passages/collect";
import { locateVerse } from "@/lib/services/passages/locate";
import { SurahNames, type SurahName } from "@/lib/services/passages/surah-names";
import type { BookResult, VerseRef } from "@/lib/services/passages/types";
import { listBooks, readBook, readPages } from "./export";
import { attributes } from "./tanzil";

export type Surah = SurahName & { verseCount: number };

/** One surah's verses from Tanzil's quran-uthmani.xml, read only to match quoted headings. */
export function surahVerses(tanzilXml: string, surah: Surah): string[] {
  const block = new RegExp(`<sura index="${surah.number}" [^>]*>([\\s\\S]*?)</sura>`).exec(
    tanzilXml,
  );
  const verses = [...(block?.[1] ?? "").matchAll(/<aya [^>]*\/>/g)].map(
    (match) => attributes(match[0]).text,
  );
  if (verses.length !== surah.verseCount) {
    throw new Error(
      `The Tanzil file has ${verses.length} verses for surah ${surah.number}, not ${surah.verseCount}.`,
    );
  }
  return verses;
}

export async function collectPassages(
  exportDir: string,
  verse: VerseRef,
  surahs: readonly Surah[],
  tanzilXml: string | null,
): Promise<BookResult[]> {
  const surah = surahs.find(({ number }) => number === verse.surah);
  if (!surah || verse.ayah > surah.verseCount) {
    throw new Error(`There is no verse ${verse.surah}:${verse.ayah}.`);
  }
  const names = new SurahNames(surahs);
  const verses = tanzilXml === null ? null : surahVerses(tanzilXml, surah);
  const results: BookResult[] = [];
  for (const id of listBooks(exportDir)) {
    const book = await readBook(exportDir, id);
    const location = locateVerse(book, verse, surah.verseCount, names, verses);
    const range = pagesToRead(location);
    const pages = range ? await readPages(exportDir, id, range.from, range.to) : [];
    results.push(collectPages(book, location, pages, verse, surah.verseCount, names));
  }
  return results;
}
