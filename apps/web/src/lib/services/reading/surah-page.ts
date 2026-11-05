import { getPassages, getSurahContent, getSurahQuestions, getVerseTexts } from "@/lib/data/content";
import { questionPassageIds, questionsBySection, type QuestionsBySection } from "@/lib/services/qa";
import {
  buildSurahPageView,
  citedPassageIds,
  referencedVerses,
  type SurahPageView,
} from "./surah-view";

/** The surah page with each reading section's fixed questions. */
export type SurahPage = SurahPageView & { questions: QuestionsBySection };

/** The surah page, or null when the surah isn't in the database yet. */
export async function loadSurahPage(surah: number): Promise<SurahPage | null> {
  const [content, questions] = await Promise.all([
    getSurahContent(surah),
    getSurahQuestions(surah),
  ]);
  if (!content) {
    return null;
  }
  const passageIds = [
    ...new Set([...citedPassageIds(content), ...questionPassageIds(questions)]),
  ].sort();
  const [passages, verseTexts] = await Promise.all([
    getPassages(passageIds),
    getVerseTexts(referencedVerses(content)),
  ]);
  const view = buildSurahPageView(content, passages, verseTexts);
  const passagesById = new Map(passages.map((passage) => [passage.id, passage]));
  return { ...view, questions: questionsBySection(view.sections, questions, passagesById) };
}
