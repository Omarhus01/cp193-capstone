import { getPassages, getSurahContent, getWordMeaningsByRoot } from "@/lib/data/content";
import {
  buildSurahPageView,
  citedPassageIds,
  rootsWithMeanings,
  type SurahPageView,
} from "./surah-view";

/** The surah page, or null when the surah isn't in the database yet. */
export async function loadSurahPage(surah: number): Promise<SurahPageView | null> {
  const content = await getSurahContent(surah);
  if (!content) {
    return null;
  }
  const [passages, rootMeanings] = await Promise.all([
    getPassages(citedPassageIds(content)),
    getWordMeaningsByRoot(rootsWithMeanings(content)),
  ]);
  return buildSurahPageView(content, passages, rootMeanings);
}
