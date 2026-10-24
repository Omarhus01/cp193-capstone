import type {
  Explanation,
  ExplanationKind,
  Localized,
  Passage,
  RevelationPlace,
  SourceType,
  Span,
  Surah,
  Verse,
  WordMeaning,
} from "@/lib/domain/content";

// Rows as the queries in content.ts select them (tables in
// supabase/migrations/…_create_content.sql), and their mapping to domain types.

export type SpanRow = {
  id: string;
  start_surah: number;
  start_ayah: number;
  start_word: number | null;
  end_surah: number;
  end_ayah: number;
  end_word: number | null;
};

export type SurahRow = {
  number: number;
  name_ar: string;
  name_en: string | null;
  name_ko: string | null;
  revelation_place: RevelationPlace;
  verse_count: number;
  basmala_ar: string | null;
};

export type VerseRow = {
  surah: number;
  ayah: number;
  text_ar: string;
  word: { position: number; text_ar: string; root: string | null }[];
};

type Ordered = { sort_order: number };

export type ExplanationRow = {
  id: string;
  kind: ExplanationKind;
  word_meanings_en: string | null;
  word_meanings_ko: string | null;
  background_en: string | null;
  background_ko: string | null;
  context_en: string | null;
  context_ko: string | null;
  connected_verses_en: string | null;
  connected_verses_ko: string | null;
  span: SpanRow;
  explanation_citation: (Ordered & { passage_id: string })[];
  context_link: (Ordered & { reason_en: string | null; reason_ko: string | null; span: SpanRow })[];
};

export type WordMeaningRow = {
  surah: number;
  ayah: number;
  position: number;
  meaning_en: string | null;
  meaning_ko: string | null;
  word_meaning_citation: (Ordered & { passage_id: string })[];
};

export type PassageRow = {
  id: string;
  volume: string | null;
  page: string | null;
  verse_surah: number | null;
  verse_ayah: number | null;
  text_ar: string | null;
  summary_en: string | null;
  summary_ko: string | null;
  source: {
    id: string;
    title_ar: string | null;
    title_en: string | null;
    author: string;
    edition: string | null;
    type: SourceType;
  };
};

/**
 * The keys the database stores for a span (generated columns start_key and end_key): a missing
 * word counts as 0 at the start and 999 at the end. Two spans overlap when each starts no later
 * than the other ends.
 */
export function spanKeys({ start, end }: Span): { start: number; end: number } {
  return {
    start: start.surah * 1_000_000 + start.ayah * 1000 + (start.word ?? 0),
    end: end.surah * 1_000_000 + end.ayah * 1000 + (end.word ?? 999),
  };
}

function byOrder<T extends Ordered>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}

const localized = (en: string | null, ko: string | null): Localized => ({ en, ko });

export function toSpan(row: SpanRow): Span {
  return {
    start: { surah: row.start_surah, ayah: row.start_ayah, word: row.start_word },
    end: { surah: row.end_surah, ayah: row.end_ayah, word: row.end_word },
  };
}

export function toSurah(row: SurahRow): Surah {
  return {
    number: row.number,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    nameKo: row.name_ko,
    revelationPlace: row.revelation_place,
    verseCount: row.verse_count,
    basmalaAr: row.basmala_ar,
  };
}

export function toVerse(row: VerseRow): Verse {
  return {
    surah: row.surah,
    ayah: row.ayah,
    textAr: row.text_ar,
    words: [...row.word]
      .sort((a, b) => a.position - b.position)
      .map((word) => ({ position: word.position, textAr: word.text_ar, root: word.root })),
  };
}

export function toExplanation(row: ExplanationRow): Explanation {
  return {
    id: row.id,
    kind: row.kind,
    span: toSpan(row.span),
    parts: {
      wordMeanings: localized(row.word_meanings_en, row.word_meanings_ko),
      background: localized(row.background_en, row.background_ko),
      context: localized(row.context_en, row.context_ko),
      connectedVerses: localized(row.connected_verses_en, row.connected_verses_ko),
    },
    contextLinks: byOrder(row.context_link).map((link) => ({
      span: toSpan(link.span),
      reason: localized(link.reason_en, link.reason_ko),
    })),
    passageIds: byOrder(row.explanation_citation).map((citation) => citation.passage_id),
  };
}

export function toWordMeaning(row: WordMeaningRow): WordMeaning {
  return {
    word: { surah: row.surah, ayah: row.ayah, word: row.position },
    meaning: localized(row.meaning_en, row.meaning_ko),
    passageIds: byOrder(row.word_meaning_citation).map((citation) => citation.passage_id),
  };
}

export function toPassage(row: PassageRow): Passage {
  const { source } = row;
  return {
    id: row.id,
    source: {
      id: source.id,
      titleAr: source.title_ar,
      titleEn: source.title_en,
      author: source.author,
      edition: source.edition,
      type: source.type,
    },
    volume: row.volume,
    page: row.page,
    verse:
      row.verse_surah !== null && row.verse_ayah !== null
        ? { surah: row.verse_surah, ayah: row.verse_ayah }
        : null,
    textAr: row.text_ar,
    summary: localized(row.summary_en, row.summary_ko),
  };
}
