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

/** A surah with published explanations, and which of its verses are in the database. */
export type PublishedSurah = {
  number: number;
  nameAr: string;
  nameEn: string | null;
  nameKo: string | null;
  verseCount: number;
  /** The verses the database holds, in order: all of them, or only some (ADR 0022). */
  ayahs: number[];
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
  /** Where a reader can open the cited pages (https), or null. */
  url: string | null;
};

export type ExplanationKind = "phrase_note" | "verse_explanation" | "reading_section";

/** A cited passage, and who the passage quotes or narrates from ("Muslim"), if anyone. */
export type Citation = { passageId: string; quoting: string | null };

/** One point of an explanation, or one paragraph of a brief, with the sources behind it. */
export type ContentItem = { text: Localized; citations: Citation[] };

/** A verse an explanation relates to, and why. The verse may be in a surah that isn't imported. */
export type RelatedVerse = ContentItem & { verse: VerseRef };

/**
 * The four parts of an explanation (proposal §1.1), each a list of points with their own sources
 * (ADR 0015). `context` is shown as "Meaning"; `wordMeanings` is never shown on the page.
 */
export type ExplanationParts = {
  wordMeanings: ContentItem[];
  background: ContentItem[];
  context: ContentItem[];
  relatedVerses: RelatedVerse[];
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
  /** Every passage its points cite, each once, in the order its parts first cite them. */
  passageIds: string[];
};

/** What a word means elsewhere: in another verse, or (without a verse) in Arabic usage. */
export type ElsewhereNote = { verse: VerseRef | null; text: Localized };

/** What a word means in its verse. */
export type WordMeaning = {
  word: VerseRef & { word: number };
  meaning: Localized;
  citations: Citation[];
  elsewhere: ElsewhereNote[];
};

/**
 * A published fixed question about a span of whole verses, with the owner's answer and the sources
 * behind it (ADR 0018).
 */
export type FixedQuestion = {
  id: string;
  span: Span;
  question: Localized;
  answer: Localized;
  citations: Citation[];
};

/** A verse's Arabic text, for showing a referenced verse. */
export type VerseText = VerseRef & { textAr: string };

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
  /** The published brief's paragraphs, or null. */
  brief: ContentItem[] | null;
  verses: Verse[];
  wordMeanings: WordMeaning[];
  /** Every section in reading order, published or not. */
  readingSections: ReadingSectionSummary[];
};
