import { getPassages, getSurahContent, getVerseTexts } from "@/lib/data/content";
import { getPassagesPreview, getSurahContentPreview } from "@/lib/data/content-preview";
import {
  buildSurahPageView,
  citedPassageIds,
  referencedVerses,
  type SurahPageView,
} from "./surah-view";

/**
 * The surah page, or null when the surah isn't in the database yet. Readers get published content
 * from the shared cache. With `preview` (testers only), the content is read with the user's own
 * session and never cached, so drafts can't reach other readers (ADR 0016).
 */
export async function loadSurahPage(
  surah: number,
  { preview = false }: { preview?: boolean } = {},
): Promise<SurahPageView | null> {
  const content = preview ? await getSurahContentPreview(surah) : await getSurahContent(surah);
  if (!content) {
    return null;
  }
  const ids = citedPassageIds(content);
  const [passages, verseTexts] = await Promise.all([
    preview ? getPassagesPreview(ids) : getPassages(ids),
    // The Quran text has no drafts, so the cached function serves both paths.
    getVerseTexts(referencedVerses(content)),
  ]);
  return buildSurahPageView(content, passages, verseTexts);
}
