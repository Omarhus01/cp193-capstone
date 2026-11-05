import type {
  Citation,
  ContentItem,
  Explanation,
  ExplanationKind,
  FixedQuestion,
  Localized,
  Passage,
  RevelationPlace,
  SourceType,
  Span,
  Surah,
  Verse,
  WordMeaning,
} from "@/lib/domain/content";

// Rows as the queries in content.ts select them (tables in supabase/migrations/), and their
// mapping to domain types.

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
  verse_transliteration: { language: "en" | "ko"; text: string | null; status: string }[];
};

type Ordered = { sort_order: number };

export type CitationRow = Ordered & { passage_id: string; quoting: string | null };

export type ItemRow = Ordered & {
  text_en: string | null;
  text_ko: string | null;
  verse_surah: number | null;
  verse_ayah: number | null;
};

export type ExplanationItemRow = ItemRow & {
  part: "word_meanings" | "background" | "context" | "connected_verses";
  explanation_item_citation: CitationRow[];
};

export type ExplanationRow = {
  id: string;
  kind: ExplanationKind;
  span: SpanRow;
  explanation_citation: (Ordered & { passage_id: string })[];
  explanation_item: ExplanationItemRow[];
  context_link: (Ordered & { reason_en: string | null; reason_ko: string | null; span: SpanRow })[];
};

export type BriefItemRow = Ordered & {
  text_en: string | null;
  text_ko: string | null;
  surah_brief_item_citation: CitationRow[];
};

export type WordMeaningRow = {
  surah: number;
  ayah: number;
  position: number;
  meaning_en: string | null;
  meaning_ko: string | null;
  word_meaning_citation: CitationRow[];
  word_meaning_elsewhere: (Ordered & {
    verse_surah: number | null;
    verse_ayah: number | null;
    text_en: string | null;
    text_ko: string | null;
  })[];
};

export type QaQuestionRow = {
  id: string;
  question_en: string | null;
  question_ko: string | null;
  answer_en: string | null;
  answer_ko: string | null;
  span: SpanRow;
  qa_question_citation: CitationRow[];
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
  url: string | null;
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

const verseRef = (surah: number | null, ayah: number | null) =>
  surah !== null && ayah !== null ? { surah, ayah } : null;

function toCitations(rows: CitationRow[]): Citation[] {
  return byOrder(rows).map((row) => ({ passageId: row.passage_id, quoting: row.quoting }));
}

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
  // Row level security returns published transliterations only; check again here.
  const transliteration = (language: "en" | "ko") =>
    row.verse_transliteration.find((t) => t.language === language && t.status === "published")
      ?.text ?? null;
  return {
    surah: row.surah,
    ayah: row.ayah,
    textAr: row.text_ar,
    words: [...row.word]
      .sort((a, b) => a.position - b.position)
      .map((word) => ({ position: word.position, textAr: word.text_ar, root: word.root })),
    transliteration: localized(transliteration("en"), transliteration("ko")),
  };
}

export function toExplanation(row: ExplanationRow): Explanation {
  const items = (part: ExplanationItemRow["part"]) =>
    byOrder(row.explanation_item.filter((item) => item.part === part));
  const toItem = (item: ExplanationItemRow): ContentItem => ({
    text: localized(item.text_en, item.text_ko),
    citations: toCitations(item.explanation_item_citation),
  });
  return {
    id: row.id,
    kind: row.kind,
    span: toSpan(row.span),
    parts: {
      wordMeanings: items("word_meanings").map(toItem),
      background: items("background").map(toItem),
      context: items("context").map(toItem),
      relatedVerses: items("connected_verses").flatMap((item) => {
        const verse = verseRef(item.verse_surah, item.verse_ayah);
        return verse ? [{ ...toItem(item), verse }] : [];
      }),
    },
    contextLinks: byOrder(row.context_link).map((link) => ({
      span: toSpan(link.span),
      reason: localized(link.reason_en, link.reason_ko),
    })),
    passageIds: byOrder(row.explanation_citation).map((citation) => citation.passage_id),
  };
}

export function toBrief(rows: BriefItemRow[]): ContentItem[] {
  return byOrder(rows).map((row) => ({
    text: localized(row.text_en, row.text_ko),
    citations: toCitations(row.surah_brief_item_citation),
  }));
}

export function toWordMeaning(row: WordMeaningRow): WordMeaning {
  return {
    word: { surah: row.surah, ayah: row.ayah, word: row.position },
    meaning: localized(row.meaning_en, row.meaning_ko),
    citations: toCitations(row.word_meaning_citation),
    elsewhere: byOrder(row.word_meaning_elsewhere).map((note) => ({
      verse: verseRef(note.verse_surah, note.verse_ayah),
      text: localized(note.text_en, note.text_ko),
    })),
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
    verse: verseRef(row.verse_surah, row.verse_ayah),
    textAr: row.text_ar,
    summary: localized(row.summary_en, row.summary_ko),
    url: row.url,
  };
}

export function toFixedQuestion(row: QaQuestionRow): FixedQuestion {
  return {
    id: row.id,
    span: toSpan(row.span),
    question: localized(row.question_en, row.question_ko),
    answer: localized(row.answer_en, row.answer_ko),
    citations: toCitations(row.qa_question_citation),
  };
}
