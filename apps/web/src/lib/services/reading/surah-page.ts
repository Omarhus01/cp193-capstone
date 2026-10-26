import { getPassages, getSurahContent, getVerseTexts } from "@/lib/data/content";
import {
  buildSurahPageView,
  citedPassageIds,
  referencedVerses,
  type SurahPageView,
} from "./surah-view";

/** The surah page, or null when the surah isn't in the database yet. */
export async function loadSurahPage(surah: number): Promise<SurahPageView | null> {
  const content = await getSurahContent(surah);
  if (!content) {
    return null;
  }
  const [passages, verseTexts] = await Promise.all([
    getPassages(citedPassageIds(content)),
    getVerseTexts(referencedVerses(content)),
  ]);
  return buildSurahPageView(content, passages, verseTexts);
}
