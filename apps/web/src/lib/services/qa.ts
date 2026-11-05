import type { FixedQuestion, Localized, Passage, VerseRef } from "@/lib/domain/content";
import { sourceNumbering, type SourceView } from "./reading/surah-view";

// Fixed questions on the surah page (ADR 0018): the owner's questions and answers, stored and
// reviewed like explanations, listed under the reading section they are about. Pure functions, so
// the Q&A panel (a client component) can import them; reading/surah-page.ts loads the questions.
// Questions a reader types go to the RetrievalProvider in lib/ai once it exists (#10).

/** A question with its answer, and the sources behind the answer, numbered within the answer. */
export type QuestionView = {
  id: string;
  question: Localized;
  answer: Localized;
  sources: SourceView[];
};

/** Each reading section's questions, keyed by the section's position. */
export type QuestionsBySection = Record<number, QuestionView[]>;

const written = (text: Localized) => Boolean(text.en || text.ko);

/**
 * Puts each question under the section that holds the first verse of its span, in their order.
 * A question with no visible source, or with nothing written, is left out: an answer is never
 * shown without its sources.
 */
export function questionsBySection(
  sections: readonly { position: number; verses: readonly VerseRef[] }[],
  questions: readonly FixedQuestion[],
  passages: ReadonlyMap<string, Passage>,
): QuestionsBySection {
  const bySection: QuestionsBySection = {};
  for (const question of questions) {
    const { surah, ayah } = question.span.start;
    const section = sections.find((s) =>
      s.verses.some((verse) => verse.surah === surah && verse.ayah === ayah),
    );
    const sources = sourceNumbering(passages)(question.citations);
    if (!section || sources.length === 0) {
      continue;
    }
    if (!written(question.question) || !written(question.answer)) {
      continue;
    }
    (bySection[section.position] ??= []).push({
      id: question.id,
      question: question.question,
      answer: question.answer,
      sources,
    });
  }
  return bySection;
}

/** The questions of the section at `position`, or none. */
export function questionsForSection(
  bySection: QuestionsBySection,
  position: number,
): QuestionView[] {
  return bySection[position] ?? [];
}

/** The passages the questions cite, each once. */
export function questionPassageIds(questions: readonly FixedQuestion[]): string[] {
  return [...new Set(questions.flatMap((q) => q.citations.map((c) => c.passageId)))];
}
