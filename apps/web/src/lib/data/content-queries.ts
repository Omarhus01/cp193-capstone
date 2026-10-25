import type { SupabaseClient } from "@supabase/supabase-js";
import type { Passage, SurahContent } from "@/lib/domain/content";
import {
  toBrief,
  toExplanation,
  toPassage,
  toSpan,
  toSurah,
  toVerse,
  toWordMeaning,
  type BriefRow,
  type ExplanationRow,
  type PassageRow,
  type SpanRow,
  type SurahRow,
  type VerseRow,
  type WordMeaningRow,
} from "./content-mappers";

// The queries behind the surah page, shared by its two paths (ADR 0016):
// - "published": content.ts runs them as the anon role and caches the result. Every query also
//   filters on status = 'published', on top of row level security.
// - "preview": content-preview.ts runs them with a tester's session, never cached. There is no
//   status filter: row level security decides what the session may read (published content, and
//   content in review for testers).

export type ContentMode = "published" | "preview";

export const SPAN = "id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word";
export const VERSE = `surah, ayah, text_ar, word(position, text_ar, root),
  verse_transliteration(language, text, status)`;
const CITATION = "sort_order, passage_id, quoting";
export const EXPLANATION = `id, kind, status, span!inner(${SPAN}),
  explanation_citation(passage_id, sort_order),
  explanation_item(part, sort_order, text_en, text_ko, verse_surah, verse_ayah,
    explanation_item_citation(${CITATION})),
  context_link(sort_order, reason_en, reason_ko, span(${SPAN}))`;
const WORD_MEANING = `surah, ayah, position, meaning_en, meaning_ko, status,
  word_meaning_citation(${CITATION}),
  word_meaning_elsewhere(sort_order, verse_surah, verse_ayah, text_en, text_ko)`;
const BRIEF = `status,
  surah_brief_item(sort_order, text_en, text_ko, surah_brief_item_citation(${CITATION}))`;
export const PASSAGE = `id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko,
  source!inner(id, title_ar, title_en, author, edition, type)`;

export function rows<T>(
  result: { data: unknown; error: { message: string } | null },
  what: string,
): T {
  if (result.error) {
    throw new Error(`Couldn't load ${what}: ${result.error.message}`);
  }
  return result.data as T;
}

/**
 * A surah with its verses, words and transliterations, its brief and word meanings, and all of its
 * reading sections with their explanations, as far as `mode` and the session allow. Null when
 * the surah isn't in the database.
 */
export async function querySurahContent(
  db: SupabaseClient,
  surah: number,
  mode: ContentMode,
): Promise<SurahContent | null> {
  const published = mode === "published";
  let brief = db.from("surah_brief").select(BRIEF).eq("surah", surah);
  let verses = db.from("verse").select(VERSE).eq("surah", surah);
  let meanings = db.from("word_meaning").select(WORD_MEANING).eq("surah", surah);
  let explanations = db
    .from("explanation")
    .select(EXPLANATION)
    .eq("kind", "reading_section")
    .eq("span.start_surah", surah);
  if (published) {
    brief = brief.eq("status", "published");
    verses = verses.eq("verse_transliteration.status", "published");
    meanings = meanings.eq("status", "published");
    explanations = explanations.eq("status", "published");
  }

  const [surahResult, briefResult, versesResult, meaningsResult, sectionsResult, explanationRows] =
    await Promise.all([
      db
        .from("surah")
        .select("number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar")
        .eq("number", surah)
        .maybeSingle(),
      brief.maybeSingle(),
      verses.order("ayah"),
      meanings.order("ayah").order("position"),
      db
        .from("reading_section")
        .select(`position, explanation_id, span!inner(${SPAN})`)
        .eq("surah", surah)
        .order("position"),
      explanations,
    ]);

  const surahRow = rows<SurahRow | null>(surahResult, `surah ${surah}`);
  if (!surahRow) {
    return null;
  }
  const briefRow = rows<BriefRow | null>(briefResult, `the brief of surah ${surah}`);
  const sections = rows<{ position: number; explanation_id: string; span: SpanRow }[]>(
    sectionsResult,
    `the reading sections of surah ${surah}`,
  );
  const loaded = new Map(
    rows<ExplanationRow[]>(explanationRows, `the reading section explanations of surah ${surah}`)
      .map(toExplanation)
      .map((explanation) => [explanation.id, explanation]),
  );
  return {
    surah: toSurah(surahRow),
    brief: briefRow ? toBrief(briefRow) : null,
    verses: rows<VerseRow[]>(versesResult, `the verses of surah ${surah}`).map((row) =>
      toVerse(row, mode),
    ),
    wordMeanings: rows<WordMeaningRow[]>(meaningsResult, `the word meanings of surah ${surah}`).map(
      toWordMeaning,
    ),
    readingSections: sections.map((section) => ({
      position: section.position,
      span: toSpan(section.span),
      explanation: loaded.get(section.explanation_id) ?? null,
    })),
  };
}

/**
 * The passages with these ids, with their sources, in the order asked for. Row level security
 * returns only passages the session may read; others are left out.
 */
export async function queryPassages(
  db: SupabaseClient,
  ids: readonly string[],
): Promise<Passage[]> {
  if (ids.length === 0) {
    return [];
  }
  const result = await db
    .from("passage")
    .select(PASSAGE)
    .in("id", [...ids]);
  const passages = new Map(
    rows<PassageRow[]>(result, "passages")
      .map(toPassage)
      .map((passage) => [passage.id, passage]),
  );
  return ids.flatMap((id) => passages.get(id) ?? []);
}
