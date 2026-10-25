import type { Span } from "@/lib/domain/content";
import type { ReviewEntry } from "@/lib/services/review";
import type { ContentBundle } from "./load";
import { readCitation, type CitationEntry, type ItemEntry } from "./schema";
import { parseRef, parseSpan, spanId, type SpanRefs } from "./spans";

// The argument of the seed_content database function (supabase/migrations/, last replaced in
// …_reading_structure_and_transliteration.sql).
// Keys are table names and rows use the column names, so the function can read them with
// jsonb_populate_recordset. Rows are sorted, so the same content always gives the same payload.

type Row = Record<string, string | number | null>;

export type SeedPayload = {
  surahs: Row[];
  verses: Row[];
  words: Row[];
  sources: Row[];
  passages: Row[];
  spans: Row[];
  explanations: Row[];
  explanation_citations: Row[];
  context_links: Row[];
  reading_sections: Row[];
  explanation_reviews: Row[];
  surah_briefs: Row[];
  surah_brief_reviews: Row[];
  word_meanings: Row[];
  word_meaning_citations: Row[];
  word_meaning_reviews: Row[];
  verse_transliterations: Row[];
  verse_transliteration_reviews: Row[];
  explanation_items: Row[];
  explanation_item_citations: Row[];
  surah_brief_items: Row[];
  surah_brief_item_citations: Row[];
  word_meaning_elsewhere: Row[];
};

/** The database's name for each part of an explanation (enum explanation_part). */
const PARTS = {
  context: "context",
  background: "background",
  connectedVerses: "connected_verses",
  wordMeanings: "word_meanings",
} as const;

function citationRows(key: Row, citations: CitationEntry[]): Row[] {
  return citations.map(readCitation).map(({ passage, quoting }, sortOrder) => ({
    ...key,
    sort_order: sortOrder,
    passage_id: passage,
    quoting,
  }));
}

function reviewRows(key: Row, review: ReviewEntry[]): Row[] {
  return review.map((entry, step) => ({
    ...key,
    step,
    status: entry.status,
    reviewer: entry.reviewer,
    reviewed_on: entry.date,
    notes: entry.notes ?? null,
  }));
}

function byKeys(...keys: string[]) {
  return (a: Row, b: Row) => {
    for (const key of keys) {
      const [x, y] = [a[key] ?? "", b[key] ?? ""];
      if (x !== y) {
        return x < y ? -1 : 1;
      }
    }
    return 0;
  };
}

/**
 * Builds the seed payload from content that has passed validateContent. Throws on a broken span or
 * ref, which validation would have reported.
 */
export function toSeedPayload(bundle: ContentBundle): SeedPayload {
  const payload: SeedPayload = {
    surahs: [],
    verses: [],
    words: [],
    sources: [],
    passages: [],
    spans: [],
    explanations: [],
    explanation_citations: [],
    context_links: [],
    reading_sections: [],
    explanation_reviews: [],
    surah_briefs: [],
    surah_brief_reviews: [],
    word_meanings: [],
    word_meaning_citations: [],
    word_meaning_reviews: [],
    verse_transliterations: [],
    verse_transliteration_reviews: [],
    explanation_items: [],
    explanation_item_citations: [],
    surah_brief_items: [],
    surah_brief_item_citations: [],
    word_meaning_elsewhere: [],
  };

  const spans = new Map<string, Span>();
  function addSpan(refs: SpanRefs): string {
    const span = parseSpan(refs);
    if (!span) {
      throw new Error(`Invalid span ${refs.from}-${refs.to}; run the content validation first.`);
    }
    const id = spanId(span);
    spans.set(id, span);
    return id;
  }

  for (const { source, passages } of bundle.sources) {
    payload.sources.push({
      id: source.id,
      title_ar: source.titleAr,
      title_en: source.titleEn,
      author: source.author,
      edition: source.edition,
      type: source.type,
    });
    for (const passage of passages) {
      const verse = passage.verse ? parseRef(passage.verse) : null;
      payload.passages.push({
        id: passage.id,
        source_id: source.id,
        volume: passage.volume,
        page: passage.page,
        verse_surah: verse?.surah ?? null,
        verse_ayah: verse?.ayah ?? null,
        text_ar: passage.textAr,
        summary_en: passage.summary.en,
        summary_ko: passage.summary.ko,
      });
    }
  }

  for (const surah of bundle.surahs) {
    const { number, text, words } = surah;
    payload.surahs.push({
      number,
      name_ar: text.surah.nameAr,
      name_en: surah.surah.names.en,
      name_ko: surah.surah.names.ko,
      revelation_place: text.surah.revelationPlace,
      verse_count: text.surah.verseCount,
      basmala_ar: text.surah.basmala,
    });
    for (const verse of text.verses) {
      payload.verses.push({ surah: number, ayah: verse.ayah, text_ar: verse.text });
    }
    for (const verse of words.verses) {
      for (const word of verse.words) {
        payload.words.push({
          surah: number,
          ayah: verse.ayah,
          position: word.position,
          text_ar: word.text,
          root: word.root,
        });
      }
    }

    for (const explanation of surah.explanations) {
      const { id, parts } = explanation;
      payload.explanations.push({
        id,
        span_id: addSpan(explanation.span),
        kind: explanation.kind,
        status: explanation.status,
      });
      // The explanation's passages, each once, in the order its parts first cite them.
      const passages = new Set<string>();
      for (const [part, dbPart] of Object.entries(PARTS) as [keyof typeof PARTS, string][]) {
        parts[part].forEach((item: ItemEntry & { verse?: string }, i) => {
          const verse = item.verse ? parseRef(item.verse) : null;
          payload.explanation_items.push({
            explanation_id: id,
            part: dbPart,
            sort_order: i,
            text_en: item.en,
            text_ko: item.ko,
            verse_surah: verse?.surah ?? null,
            verse_ayah: verse?.ayah ?? null,
          });
          const key = { explanation_id: id, part: dbPart, item_order: i };
          payload.explanation_item_citations.push(...citationRows(key, item.citations));
          item.citations.forEach((citation) => passages.add(readCitation(citation).passage));
        });
      }
      [...passages].forEach((passageId, sortOrder) =>
        payload.explanation_citations.push({
          explanation_id: id,
          passage_id: passageId,
          sort_order: sortOrder,
        }),
      );
      explanation.contextLinks.forEach((link, sortOrder) =>
        payload.context_links.push({
          explanation_id: id,
          sort_order: sortOrder,
          span_id: addSpan(link.span),
          reason_en: link.reason.en,
          reason_ko: link.reason.ko,
        }),
      );
      payload.explanation_reviews.push(...reviewRows({ explanation_id: id }, explanation.review));
    }

    surah.readingSections.forEach((explanationId, i) => {
      const explanation = surah.explanations.find(({ id }) => id === explanationId);
      if (!explanation) {
        throw new Error(
          `Unknown reading section ${explanationId}; run the content validation first.`,
        );
      }
      payload.reading_sections.push({
        surah: number,
        position: i + 1,
        explanation_id: explanationId,
        span_id: addSpan(explanation.span),
      });
    });

    for (const meaning of surah.wordMeanings) {
      const ref = parseRef(meaning.word);
      if (!ref || ref.word === null) {
        throw new Error(`Invalid word ref ${meaning.word}; run the content validation first.`);
      }
      const key = { surah: ref.surah, ayah: ref.ayah, position: ref.word };
      payload.word_meanings.push({
        ...key,
        meaning_en: meaning.meaning.en,
        meaning_ko: meaning.meaning.ko,
        status: meaning.status,
      });
      payload.word_meaning_citations.push(...citationRows(key, meaning.citations));
      meaning.elsewhere.forEach((other, sortOrder) => {
        const verse = other.verse ? parseRef(other.verse) : null;
        payload.word_meaning_elsewhere.push({
          ...key,
          sort_order: sortOrder,
          verse_surah: verse?.surah ?? null,
          verse_ayah: verse?.ayah ?? null,
          text_en: other.en,
          text_ko: other.ko,
        });
      });
      payload.word_meaning_reviews.push(...reviewRows(key, meaning.review));
    }

    for (const item of surah.transliterations) {
      const ref = parseRef(item.verse);
      if (!ref) {
        throw new Error(`Invalid verse ref ${item.verse}; run the content validation first.`);
      }
      const key = { surah: ref.surah, ayah: ref.ayah, language: item.language };
      payload.verse_transliterations.push({ ...key, text: item.text, status: item.status });
      payload.verse_transliteration_reviews.push(...reviewRows(key, item.review));
    }

    const brief = surah.surah.brief;
    if (brief) {
      payload.surah_briefs.push({ surah: number, status: brief.status });
      brief.items.forEach((item, i) => {
        payload.surah_brief_items.push({
          surah: number,
          sort_order: i,
          text_en: item.en,
          text_ko: item.ko,
        });
        payload.surah_brief_item_citations.push(
          ...citationRows({ surah: number, item_order: i }, item.citations),
        );
      });
      payload.surah_brief_reviews.push(...reviewRows({ surah: number }, brief.review));
    }
  }

  for (const [id, { start, end }] of spans) {
    payload.spans.push({
      id,
      start_surah: start.surah,
      start_ayah: start.ayah,
      start_word: start.word,
      end_surah: end.surah,
      end_ayah: end.ayah,
      end_word: end.word,
    });
  }

  payload.surahs.sort(byKeys("number"));
  payload.verses.sort(byKeys("surah", "ayah"));
  payload.words.sort(byKeys("surah", "ayah", "position"));
  payload.sources.sort(byKeys("id"));
  payload.passages.sort(byKeys("id"));
  payload.spans.sort(byKeys("id"));
  payload.explanations.sort(byKeys("id"));
  payload.explanation_citations.sort(byKeys("explanation_id", "sort_order"));
  payload.context_links.sort(byKeys("explanation_id", "sort_order"));
  payload.reading_sections.sort(byKeys("surah", "position"));
  payload.explanation_reviews.sort(byKeys("explanation_id", "step"));
  payload.surah_briefs.sort(byKeys("surah"));
  payload.surah_brief_reviews.sort(byKeys("surah", "step"));
  payload.word_meanings.sort(byKeys("surah", "ayah", "position"));
  payload.word_meaning_citations.sort(byKeys("surah", "ayah", "position", "sort_order"));
  payload.word_meaning_reviews.sort(byKeys("surah", "ayah", "position", "step"));
  payload.verse_transliterations.sort(byKeys("surah", "ayah", "language"));
  payload.explanation_items.sort(byKeys("explanation_id", "part", "sort_order"));
  payload.explanation_item_citations.sort(
    byKeys("explanation_id", "part", "item_order", "sort_order"),
  );
  payload.surah_brief_items.sort(byKeys("surah", "sort_order"));
  payload.surah_brief_item_citations.sort(byKeys("surah", "item_order", "sort_order"));
  payload.word_meaning_elsewhere.sort(byKeys("surah", "ayah", "position", "sort_order"));
  payload.verse_transliteration_reviews.sort(byKeys("surah", "ayah", "language", "step"));
  return payload;
}
