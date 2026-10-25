import { cacheLife, cacheTag } from "next/cache";
import type {
  Explanation,
  Passage,
  ReadingSection,
  Span,
  SurahContent,
  VerseRef,
  VerseText,
} from "@/lib/domain/content";
import { createPublicClient } from "@/lib/supabase/public";
import {
  spanKeys,
  toBrief,
  toExplanation,
  toPassage,
  toSpan,
  toSurah,
  toVerse,
  toWordMeaning,
  type BriefItemRow,
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
//
// Published content is the same for every reader and the client sends no cookies, so each
// function is cached. During Sprint 1 the lifetime is a few minutes, so a seed shows up quickly
// while testing (ADR 0014).

const SPAN = "id, start_surah, start_ayah, start_word, end_surah, end_ayah, end_word";
const VERSE = `surah, ayah, text_ar, word(position, text_ar, root),
  verse_transliteration(language, text, status)`;
const CITATION = "sort_order, passage_id, quoting";
const EXPLANATION = `id, kind, span!inner(${SPAN}),
  explanation_citation(passage_id, sort_order),
  explanation_item(part, sort_order, text_en, text_ko, verse_surah, verse_ayah,
    explanation_item_citation(${CITATION})),
  context_link(sort_order, reason_en, reason_ko, span(${SPAN}))`;
const WORD_MEANING = `surah, ayah, position, meaning_en, meaning_ko,
  word_meaning_citation(${CITATION}),
  word_meaning_elsewhere(sort_order, verse_surah, verse_ayah, text_en, text_ko)`;
const BRIEF = `surah_brief_item(sort_order, text_en, text_ko, surah_brief_item_citation(${CITATION}))`;
const PASSAGE = `id, volume, page, verse_surah, verse_ayah, text_ar, summary_en, summary_ko,
  source!inner(id, title_ar, title_en, author, edition, type)`;

/** Marks the result of the calling function as cached published content. */
function cachePublishedContent() {
  cacheLife("minutes");
  cacheTag("content");
}

function rows<T>(result: { data: unknown; error: { message: string } | null }, what: string): T {
  if (result.error) {
    throw new Error(`Couldn't load ${what}: ${result.error.message}`);
  }
  return result.data as T;
}

/**
 * A surah with its verses, words and published transliterations, its published brief and word
 * meanings, and all of its reading sections with their published explanations.
 */
export async function getSurahContent(surah: number): Promise<SurahContent | null> {
  "use cache";
  cachePublishedContent();
  const db = createPublicClient();
  const [surahResult, briefResult, versesResult, meaningsResult, sectionsResult, explanations] =
    await Promise.all([
      db
        .from("surah")
        .select("number, name_ar, name_en, name_ko, revelation_place, verse_count, basmala_ar")
        .eq("number", surah)
        .maybeSingle(),
      db
        .from("surah_brief")
        .select(BRIEF)
        .eq("surah", surah)
        .eq("status", "published")
        .maybeSingle(),
      db
        .from("verse")
        .select(VERSE)
        .eq("surah", surah)
        .eq("verse_transliteration.status", "published")
        .order("ayah"),
      db
        .from("word_meaning")
        .select(WORD_MEANING)
        .eq("surah", surah)
        .eq("status", "published")
        .order("ayah")
        .order("position"),
      db
        .from("reading_section")
        .select(`position, explanation_id, span!inner(${SPAN})`)
        .eq("surah", surah)
        .order("position"),
      db
        .from("explanation")
        .select(EXPLANATION)
        .eq("kind", "reading_section")
        .eq("status", "published")
        .eq("span.start_surah", surah),
    ]);

  const surahRow = rows<SurahRow | null>(surahResult, `surah ${surah}`);
  if (!surahRow) {
    return null;
  }
  const brief = rows<{ surah_brief_item: BriefItemRow[] } | null>(
    briefResult,
    `the brief of surah ${surah}`,
  );
  const sections = rows<{ position: number; explanation_id: string; span: SpanRow }[]>(
    sectionsResult,
    `the reading sections of surah ${surah}`,
  );
  const published = new Map(
    rows<ExplanationRow[]>(explanations, `the reading section explanations of surah ${surah}`)
      .map(toExplanation)
      .map((explanation) => [explanation.id, explanation]),
  );
  return {
    surah: toSurah(surahRow),
    brief: brief ? toBrief(brief.surah_brief_item) : null,
    verses: rows<VerseRow[]>(versesResult, `the verses of surah ${surah}`).map(toVerse),
    wordMeanings: rows<WordMeaningRow[]>(meaningsResult, `the word meanings of surah ${surah}`).map(
      toWordMeaning,
    ),
    readingSections: sections.map((section) => ({
      position: section.position,
      span: toSpan(section.span),
      explanation: published.get(section.explanation_id) ?? null,
    })),
  };
}

/**
 * Published explanations whose span overlaps `span`, in the order they start: what a reader gets
 * after selecting part of a verse, a verse, or several verses.
 */
export async function getExplanationsForSpan(span: Span): Promise<Explanation[]> {
  "use cache";
  cachePublishedContent();
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
  "use cache";
  cachePublishedContent();
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
      .eq("verse_transliteration.status", "published")
      .gte("ayah", explanation.span.start.ayah)
      .lte("ayah", explanation.span.end.ayah)
      .order("ayah"),
    `the verses of reading section ${position} of surah ${surah}`,
  );
  return { surah, position, explanation, verses: verses.map(toVerse) };
}

/** The passages a published explanation cites, in order, with their sources. */
export async function getPassagesForExplanation(explanationId: string): Promise<Passage[]> {
  "use cache";
  cachePublishedContent();
  const result = await createPublicClient()
    .from("explanation_citation")
    .select(`sort_order, explanation!inner(status), passage!inner(${PASSAGE})`)
    .eq("explanation_id", explanationId)
    .eq("explanation.status", "published")
    .order("sort_order");
  return rows<{ passage: PassageRow }[]>(result, `the passages of ${explanationId}`).map((row) =>
    toPassage(row.passage),
  );
}

/**
 * The passages with these ids, with their sources, in the order asked for. Only passages that
 * published content cites are returned; others are left out.
 */
export async function getPassages(ids: readonly string[]): Promise<Passage[]> {
  "use cache";
  cachePublishedContent();
  if (ids.length === 0) {
    return [];
  }
  const result = await createPublicClient()
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

/**
 * The Arabic of the referenced verses that are in the database, in text order. A reference to a
 * surah that isn't imported yet is left out, so the page shows it as text instead of a link.
 */
export async function getVerseTexts(refs: readonly VerseRef[]): Promise<VerseText[]> {
  "use cache";
  cachePublishedContent();
  if (refs.length === 0) {
    return [];
  }
  const result = await createPublicClient()
    .from("verse")
    .select("surah, ayah, text_ar")
    .or(refs.map(({ surah, ayah }) => `and(surah.eq.${surah},ayah.eq.${ayah})`).join(","))
    .order("surah")
    .order("ayah");
  return rows<{ surah: number; ayah: number; text_ar: string }[]>(result, "verse texts").map(
    (row) => ({ surah: row.surah, ayah: row.ayah, textAr: row.text_ar }),
  );
}
