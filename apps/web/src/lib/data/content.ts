import type {
  Explanation,
  Passage,
  ReadingSection,
  Span,
  SurahContent,
} from "@/lib/domain/content";
import { createPublicClient } from "@/lib/supabase/public";
import {
  spanKeys,
  toExplanation,
  toPassage,
  toSpan,
  toSurah,
  toVerse,
  toWordMeaning,
  type ExplanationRow,
  type PassageRow,
  type SpanRow,
  type SurahRow,
  type VerseRow,
  type WordMeaningRow,
} from "./content-mappers";

// Published content only. Row level security already hides everything else from the anon role;
// every query also filters on status, so these functions stay correct if they ever run as a role
// that can see drafts (a reviewer, the service role).

const SPAN = "id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word";
const VERSE = "surah, ayah, text_ar, word(position, text_ar, root)";
const EXPLANATION = `id, kind, word_meanings_en, word_meanings_ko, background_en, background_ko,
  context_en, context_ko, connected_verses_en, connected_verses_ko,
  span!inner(${SPAN}),
  explanation_citation(passage_id, sort_order),
  context_link(sort_order, reason_en, reason_ko, span(${SPAN}))`;

function rows<T>(result: { data: unknown; error: { message: string } | null }, what: string): T {
  if (result.error) {
    throw new Error(`Couldn't load ${what}: ${result.error.message}`);
  }
  return result.data as T;
}

/** A surah with its verses, words, and published brief, word meanings and reading sections. */
export async function getSurahContent(surah: number): Promise<SurahContent | null> {
  const db = createPublicClient();
  const [surahResult, briefResult, versesResult, meaningsResult, sectionsResult] =
    await Promise.all([
      db
        .from("surah")
        .select("number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar")
        .eq("number", surah)
        .maybeSingle(),
      db
        .from("surah_brief")
        .select("brief_en, brief_ko")
        .eq("surah", surah)
        .eq("status", "published")
        .maybeSingle(),
      db.from("verse").select(VERSE).eq("surah", surah).order("ayah"),
      db
        .from("word_meaning")
        .select(
          "surah, ayah, position, meaning_en, meaning_ko, word_meaning_citation(passage_id, sort_order)",
        )
        .eq("surah", surah)
        .eq("status", "published")
        .order("ayah")
        .order("position"),
      db
        .from("reading_section")
        .select(`position, explanation!inner(status, span!inner(${SPAN}))`)
        .eq("surah", surah)
        .eq("explanation.status", "published")
        .order("position"),
    ]);

  const surahRow = rows<SurahRow | null>(surahResult, `surah ${surah}`);
  if (!surahRow) {
    return null;
  }
  const brief = rows<{ brief_en: string | null; brief_ko: string | null } | null>(
    briefResult,
    `the brief of surah ${surah}`,
  );
  const sections = rows<{ position: number; explanation: { span: SpanRow } }[]>(
    sectionsResult,
    `the reading sections of surah ${surah}`,
  );
  return {
    surah: toSurah(surahRow),
    brief: brief ? { en: brief.brief_en, ko: brief.brief_ko } : null,
    verses: rows<VerseRow[]>(versesResult, `the verses of surah ${surah}`).map(toVerse),
    wordMeanings: rows<WordMeaningRow[]>(meaningsResult, `the word meanings of surah ${surah}`).map(
      toWordMeaning,
    ),
    readingSections: sections.map((section) => ({
      position: section.position,
      span: toSpan(section.explanation.span),
    })),
  };
}

/**
 * Published explanations whose span overlaps `span`, in the order they start: what a reader gets
 * after selecting part of a verse, a verse, or several verses.
 */
export async function getExplanationsForSpan(span: Span): Promise<Explanation[]> {
  const keys = spanKeys(span);
  const result = await createPublicClient()
    .from("explanation")
    .select(EXPLANATION)
    .eq("status", "published")
    .lte("span.start_key", keys.end)
    .gte("span.end_key", keys.start);
  return rows<ExplanationRow[]>(result, "explanations")
    .map(toExplanation)
    .sort((a, b) => {
      const [x, y] = [spanKeys(a.span), spanKeys(b.span)];
      return x.start - y.start || x.end - y.end;
    });
}

/** A published reading section with the verses it covers, or null. */
export async function getReadingSection(
  surah: number,
  position: number,
): Promise<ReadingSection | null> {
  const db = createPublicClient();
  const section = rows<{ explanation: ExplanationRow } | null>(
    await db
      .from("reading_section")
      .select(`explanation!inner(${EXPLANATION}, status)`)
      .eq("surah", surah)
      .eq("position", position)
      .eq("explanation.status", "published")
      .maybeSingle(),
    `reading section ${position} of surah ${surah}`,
  );
  if (!section) {
    return null;
  }
  const explanation = toExplanation(section.explanation);
  const verses = rows<VerseRow[]>(
    await db
      .from("verse")
      .select(VERSE)
      .eq("surah", surah)
      .gte("ayah", explanation.span.start.ayah)
      .lte("ayah", explanation.span.end.ayah)
      .order("ayah"),
    `the verses of reading section ${position} of surah ${surah}`,
  );
  return { surah, position, explanation, verses: verses.map(toVerse) };
}

/** The passages a published explanation cites, in order, with their sources. */
export async function getPassagesForExplanation(explanationId: string): Promise<Passage[]> {
  const result = await createPublicClient()
    .from("explanation_citation")
    .select(
      `sort_order, explanation!inner(status),
       passage!inner(id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko,
         source!inner(id, title_ar, title_en, author, edition, type))`,
    )
    .eq("explanation_id", explanationId)
    .eq("explanation.status", "published")
    .order("sort_order");
  return rows<{ passage: PassageRow }[]>(result, `the passages of ${explanationId}`).map((row) =>
    toPassage(row.passage),
  );
}
