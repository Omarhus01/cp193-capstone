/**
 * Review steps of every explanation, word meaning and surah brief, in order. English is approved
 * first, then the Korean is drafted from it and approved, then the item is published.
 */
export type ReviewStatus = "draft" | "en_approved" | "ko_drafted" | "ko_approved" | "published";

/** Text in both languages. A part that isn't written (yet) is null. */
export type Localized = { en: string | null; ko: string | null };

export type VerseRef = { surah: number; ayah: number };

/** A point in the text: one word of a verse, or the whole verse when `word` is null. */
export type TextRef = VerseRef & { word: number | null };

/**
 * A stretch of the text: a phrase, a verse, or several verses (ADR 0012). A null `word` at the
 * start means the start of that verse, and at the end, the end of that verse.
 */
export type Span = { start: TextRef; end: TextRef };

export type RevelationPlace = "meccan" | "medinan";

export type Surah = {
  number: number;
  nameAr: string;
  nameEn: string | null;
  nameKo: string | null;
  revelationPlace: RevelationPlace;
  verseCount: number;
  /** Shown before verse 1. Null for Al-Fatiha, where the Basmala is verse 1, and At-Tawbah. */
  basmalaAr: string | null;
};

export type Word = { position: number; textAr: string; root: string | null };

export type Verse = VerseRef & {
  textAr: string;
  words: Word[];
  /** How the verse is pronounced: Latin letters (en) and Hangul (ko). Null until published. */
  transliteration: Localized;
};

export type SourceType = "tafsir" | "asbab_al_nuzul" | "word_dictionary" | "hadith";

export type Source = {
  id: string;
  titleAr: string | null;
  titleEn: string | null;
  author: string;
  edition: string | null;
  type: SourceType;
};

/** The place in a source that an explanation or word meaning cites. */
export type Passage = {
  id: string;
  source: Source;
  volume: string | null;
  page: string | null;
  /** For sources arranged by verse, where there is no page to cite. */
  verse: VerseRef | null;
  textAr: string | null;
  summary: Localized;
};

export type ExplanationKind = "phrase_note" | "verse_explanation" | "reading_section";

/** The four parts of an explanation (proposal §1.1). */
export type ExplanationParts = {
  wordMeanings: Localized;
  background: Localized;
  context: Localized;
  connectedVerses: Localized;
};

/** Another part of the text a reader needs in order to understand an explanation. */
export type ContextLink = { span: Span; reason: Localized };

/** A published explanation. Readers never get drafts, so there is no status here. */
export type Explanation = {
  id: string;
  kind: ExplanationKind;
  span: Span;
  parts: ExplanationParts;
  contextLinks: ContextLink[];
  /** The passages it cites, in order. */
  passageIds: string[];
};

/** What a word means in its verse. */
export type WordMeaning = {
  word: VerseRef & { word: number };
  meaning: Localized;
  passageIds: string[];
};

/** A word meaning found through the word's root, with the word and its verse for context. */
export type RootWordMeaning = WordMeaning & { root: string; wordAr: string; verseAr: string };

/**
 * A reading section of a surah. Where the sections start and end is public; the explanation is
 * null until it is published (ADR 0013).
 */
export type ReadingSectionSummary = {
  position: number;
  span: Span;
  explanation: Explanation | null;
};

export type ReadingSection = {
  surah: number;
  position: number;
  explanation: Explanation;
  verses: Verse[];
};

/** Everything a surah page needs that doesn't depend on what the reader selects. */
export type SurahContent = {
  surah: Surah;
  brief: Localized | null;
  verses: Verse[];
  wordMeanings: WordMeaning[];
  /** Every section in reading order, published or not. */
  readingSections: ReadingSectionSummary[];
};
