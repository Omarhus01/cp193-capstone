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
  toExplanation,
  toPassage,
  toVerse,
  type ExplanationRow,
  type PassageRow,
  type VerseRow,
} from "./content-mappers";
import {
  EXPLANATION,
  PASSAGE,
  VERSE,
  queryPassages,
  querySurahContent,
  rows,
} from "./content-queries";

// Published content only, the same for every reader. Every function here runs as the anon role
// with no cookies (createPublicClient) and is cached; row level security hides everything else,
// and every query also filters on status. Drafts never come through here: testers read them
// through content-preview.ts, which is never cached (ADR 0016).
//
// During Sprint 1 the cache lifetime is a few minutes, so a seed shows up quickly while testing
// (ADR 0014).

/** Marks the result of the calling function as cached published content. */
function cachePublishedContent() {
  cacheLife("minutes");
  cacheTag("content");
}

/**
 * A surah with its verses, words and published transliterations, its published brief and word
 * meanings, and all of its reading sections with their published explanations.
 */
export async function getSurahContent(surah: number): Promise<SurahContent | null> {
  "use cache";
  cachePublishedContent();
  return querySurahContent(createPublicClient(), surah, "published");
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
      .select(`explanation!inner(${EXPLANATION})`)
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
  return { surah, position, explanation, verses: verses.map((row) => toVerse(row, "published")) };
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
  return queryPassages(createPublicClient(), ids);
}

/**
 * The Arabic of the referenced verses that are in the database, in text order. A reference to a
 * surah that isn't imported yet is left out, so the page shows it as text instead of a link.
 * The Quran text is public and has no drafts, so the tester preview uses this too.
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
