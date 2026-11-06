import type {
  Citation,
  ContentItem,
  Explanation,
  Localized,
  Passage,
  ReadingSectionSummary,
  Span,
  Surah,
  SurahContent,
  Verse,
  VerseRef,
  VerseText,
} from "@/lib/domain/content";
import { isAnnotationOnly } from "@/lib/services/content/words";

// What the surah page (/[locale]/surah/[n]) shows, built from published content. Both languages
// stay in the view: the page picks the reader's language, and on Korean pages it can show the
// English too. Pure functions with no data access, so client components can import them;
// surah-page.ts loads the content.

/** A space-separated piece of a verse: a word, or a pause mark (which isn't a word, ADR 0012). */
export type VerseToken =
  | { kind: "word"; position: number; textAr: string; hasMeaning: boolean }
  | { kind: "mark"; textAr: string };

export type VerseView = VerseRef & {
  /** The id of the verse's element, for links such as "#verse-1-4". */
  anchor: string;
  /** Joined with single spaces, the tokens are the verse text exactly as Tanzil has it. */
  tokens: VerseToken[];
  /** Published transliteration per language, or null. */
  transliteration: Localized;
};

/**
 * A source behind a point: the passage, numbered within its explanation (or brief), and who the
 * passage quotes, if anyone.
 */
export type SourceView = { number: number; passage: Passage; quoting: string | null };

/** One point of an explanation, or one paragraph of a brief, with its sources (ADR 0015). */
export type ItemView = { text: Localized; sources: SourceView[] };

/** Where a verse reference leads: a link once that verse is imported, plain text until then. */
export type VerseLink = {
  /** "4:69" */
  label: string;
  surah: number;
  anchor: string;
  /** Whether the verse is in the database, so the reference can be a link. */
  available: boolean;
};

export type RelatedVerseView = ItemView & { verse: VerseLink };

/** A link to another part of the imported text (a context link, ADR 0012). */
export type ContextLinkView = {
  /** "4:69" or "4:69–70" */
  label: string;
  surah: number;
  anchor: string;
  reason: Localized;
};

/** The parts of an explanation that readers see, as lists of points. Word meanings aren't shown. */
export type ExplanationView = {
  meaning: ItemView[];
  background: ItemView[];
  relatedVerses: RelatedVerseView[];
  contextLinks: ContextLinkView[];
};

export type SectionView = {
  position: number;
  total: number;
  /** The id of the section's element: "section-2". */
  anchor: string;
  /** "1:2–4" */
  label: string;
  /** The first words of the section, for the section list. */
  previewAr: string;
  verses: VerseView[];
  /** Whether its explanation is published. When false, the section list says it is in review. */
  published: boolean;
  /** The section's words that have a published meaning, for their popovers. */
  words: Record<string, WordDetail>;
  /** Null when there is nothing to show yet: the page says the explanation is coming soon. */
  explanation: ExplanationView | null;
};

/** What a word means elsewhere: in another verse (with its Arabic once imported), or in usage. */
export type ElsewhereView = {
  verse: VerseLink | null;
  /** The verse's Arabic, when the verse is imported. */
  verseAr: string | null;
  text: Localized;
};

/** What the word popover shows. */
export type WordDetail = {
  /** "1:4:2" */
  key: string;
  ref: VerseRef & { word: number };
  textAr: string;
  root: string | null;
  meaning: Localized;
  sources: SourceView[];
  elsewhere: ElsewhereView[];
};

export type SurahPageView = {
  surah: Surah;
  /**
   * How many of the surah's verses the page shows. Below `surah.verseCount` when the surah holds
   * only some of its verses (ADR 0022).
   */
  shownVerseCount: number;
  /** The published brief's paragraphs with their sources, or null. */
  brief: ItemView[] | null;
  sections: SectionView[];
  /** Keyed by "surah:ayah:word". Only words with a published meaning are here. */
  words: Record<string, WordDetail>;
};

export const wordKey = ({ surah, ayah, word }: VerseRef & { word: number }) =>
  `${surah}:${ayah}:${word}`;

export const verseAnchor = ({ surah, ayah }: VerseRef) => `verse-${surah}-${ayah}`;

const verseKey = ({ surah, ayah }: VerseRef) => `${surah}:${ayah}`;

/** "1:1", "1:2–4", or "1:7–2:3" across surahs. */
export function formatRange({ start, end }: Span): string {
  const from = `${start.surah}:${start.ayah}`;
  if (start.surah !== end.surah) {
    return `${from}–${end.surah}:${end.ayah}`;
  }
  return start.ayah === end.ayah ? from : `${from}–${end.ayah}`;
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** 12 → "١٢", for the verse number shown after each verse. */
export function toArabicDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** The verse as tokens, in Tanzil's order, marking the words that have a published meaning. */
export function verseTokens(verse: Verse, hasMeaning: (position: number) => boolean): VerseToken[] {
  let position = 0;
  return verse.textAr
    .split(" ")
    .filter((token) => token !== "")
    .map((token): VerseToken => {
      if (isAnnotationOnly(token)) {
        return { kind: "mark", textAr: token };
      }
      position += 1;
      return { kind: "word", position, textAr: token, hasMeaning: hasMeaning(position) };
    });
}

/**
 * Numbers sources within one explanation, brief or answer: a passage keeps the number it got where
 * it was first cited, so "Source 2" is the same book page everywhere in that explanation. A
 * point's sources come back in ascending order of their numbers (2, 3, 4), whatever order the
 * point cites them in, and each source once: a repeat citation in the same point is dropped, and
 * the first citation's "via" label is the one kept. A citation of a passage readers can't see is
 * left out.
 */
export function sourceNumbering(passages: ReadonlyMap<string, Passage>) {
  const numbers = new Map<string, number>();
  return (citations: readonly Citation[]): SourceView[] =>
    citations
      .flatMap(({ passageId, quoting }) => {
        const passage = passages.get(passageId);
        if (!passage) {
          return [];
        }
        if (!numbers.has(passageId)) {
          numbers.set(passageId, numbers.size + 1);
        }
        return [{ number: numbers.get(passageId)!, passage, quoting }];
      })
      .sort((a, b) => a.number - b.number)
      .filter((source, i, sorted) => i === 0 || source.number !== sorted[i - 1].number);
}

const written = (text: Localized) => Boolean(text.en || text.ko);

function verseLink(verse: VerseRef, available: ReadonlySet<string>): VerseLink {
  return {
    label: verseKey(verse),
    surah: verse.surah,
    anchor: verseAnchor(verse),
    available: available.has(verseKey(verse)),
  };
}

/**
 * The explanation's visible parts, numbered in the order they are shown (Meaning, Background,
 * Related verses), or null when nothing is written. The word meanings part isn't shown.
 */
export function explanationView(
  explanation: Explanation,
  passages: ReadonlyMap<string, Passage>,
  availableVerses: ReadonlySet<string> = new Set(),
): ExplanationView | null {
  const { parts } = explanation;
  const sources = sourceNumbering(passages);
  const items = (list: ContentItem[]): ItemView[] =>
    list
      .filter(({ text }) => written(text))
      .map(({ text, citations }) => ({ text, sources: sources(citations) }));
  const view: ExplanationView = {
    meaning: items(parts.context),
    background: items(parts.background),
    relatedVerses: parts.relatedVerses.map(({ verse, text, citations }) => ({
      verse: verseLink(verse, availableVerses),
      text,
      sources: sources(citations),
    })),
    contextLinks: explanation.contextLinks.map(({ span, reason }) => ({
      label: formatRange(span),
      surah: span.start.surah,
      anchor: verseAnchor(span.start),
      reason,
    })),
  };
  const visible =
    view.meaning.length +
      view.background.length +
      view.relatedVerses.length +
      view.contextLinks.length >
    0;
  return visible ? view : null;
}

/** The brief's paragraphs with their sources, numbered within the brief. */
export function briefView(
  brief: readonly ContentItem[],
  passages: ReadonlyMap<string, Passage>,
): ItemView[] {
  const sources = sourceNumbering(passages);
  return brief
    .filter(({ text }) => written(text))
    .map(({ text, citations }) => ({ text, sources: sources(citations) }));
}

/**
 * A surah without reading sections still shows every verse it holds: one block per verse,
 * numbered 1, 2, 3 (not by verse number, since a surah may hold only some verses).
 */
function sectionsOf(content: SurahContent): ReadingSectionSummary[] {
  if (content.readingSections.length > 0) {
    return content.readingSections;
  }
  return content.verses.map((verse, i) => ({
    position: i + 1,
    span: {
      start: { surah: verse.surah, ayah: verse.ayah, word: null },
      end: { surah: verse.surah, ayah: verse.ayah, word: null },
    },
    explanation: null,
  }));
}

/**
 * Builds the page from published content, the passages it cites, and the Arabic of the verses it
 * refers to that are imported.
 */
export function buildSurahPageView(
  content: SurahContent,
  passages: readonly Passage[],
  verseTexts: readonly VerseText[],
): SurahPageView {
  const passagesById = new Map(passages.map((passage) => [passage.id, passage]));
  const arabic = new Map(verseTexts.map((verse) => [verseKey(verse), verse.textAr]));
  const available = new Set(arabic.keys());
  const meanings = new Map(content.wordMeanings.map((meaning) => [wordKey(meaning.word), meaning]));

  const sections = sectionsOf(content);
  const sectionViews = sections.map((section): SectionView => {
    const verses = content.verses.filter(
      (verse) => verse.ayah >= section.span.start.ayah && verse.ayah <= section.span.end.ayah,
    );
    return {
      position: section.position,
      total: sections.length,
      anchor: `section-${section.position}`,
      label: formatRange(section.span),
      previewAr: (verses[0]?.words ?? [])
        .slice(0, 2)
        .map((word) => word.textAr)
        .join(" "),
      verses: verses.map((verse) => ({
        surah: verse.surah,
        ayah: verse.ayah,
        anchor: verseAnchor(verse),
        tokens: verseTokens(verse, (word) =>
          meanings.has(wordKey({ surah: verse.surah, ayah: verse.ayah, word })),
        ),
        transliteration: verse.transliteration,
      })),
      published: section.explanation !== null,
      words: {},
      explanation: section.explanation
        ? explanationView(section.explanation, passagesById, available)
        : null,
    };
  });

  const words: Record<string, WordDetail> = {};
  for (const verse of content.verses) {
    for (const word of verse.words) {
      const ref = { surah: verse.surah, ayah: verse.ayah, word: word.position };
      const key = wordKey(ref);
      const meaning = meanings.get(key);
      if (!meaning) {
        continue;
      }
      words[key] = {
        key,
        ref,
        textAr: word.textAr,
        root: word.root,
        meaning: meaning.meaning,
        sources: sourceNumbering(passagesById)(meaning.citations),
        elsewhere: meaning.elsewhere.map((note) => ({
          verse: note.verse ? verseLink(note.verse, available) : null,
          verseAr: note.verse ? (arabic.get(verseKey(note.verse)) ?? null) : null,
          text: note.text,
        })),
      };
    }
  }

  for (const section of sectionViews) {
    const ayahs = new Set(section.verses.map((verse) => verse.ayah));
    section.words = Object.fromEntries(
      Object.entries(words).filter(([, word]) => ayahs.has(word.ref.ayah)),
    );
  }

  return {
    surah: content.surah,
    shownVerseCount: content.verses.length,
    brief: content.brief ? briefView(content.brief, passagesById) : null,
    sections: sectionViews,
    words,
  };
}

/** The ids of every passage cited on the page, sorted, so the same page asks the same question. */
export function citedPassageIds(content: SurahContent): string[] {
  const ids = new Set([
    ...content.readingSections.flatMap((section) => section.explanation?.passageIds ?? []),
    ...content.wordMeanings.flatMap((meaning) => meaning.citations.map((c) => c.passageId)),
    ...(content.brief ?? []).flatMap((item) => item.citations.map((c) => c.passageId)),
  ]);
  return [...ids].sort();
}

/** Every verse the page refers to (related verses, elsewhere notes), each once, in text order. */
export function referencedVerses(content: SurahContent): VerseRef[] {
  const refs = new Map<string, VerseRef>();
  const add = (verse: VerseRef | null) => {
    if (verse) {
      refs.set(verseKey(verse), { surah: verse.surah, ayah: verse.ayah });
    }
  };
  for (const section of content.readingSections) {
    section.explanation?.parts.relatedVerses.forEach(({ verse }) => add(verse));
  }
  for (const meaning of content.wordMeanings) {
    meaning.elsewhere.forEach(({ verse }) => add(verse));
  }
  return [...refs.values()].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

/**
 * How a source is named: a message key of "surah.passage" and its values, and the edition, which
 * the page puts in parentheses after the title ("surah.passage.titleEdition").
 */
export function passageLabel(passage: Passage): {
  key: "volumePage" | "volumePages" | "page" | "pages" | "verse";
  values: Record<string, string>;
  edition: string | null;
} {
  const { author, titleEn, titleAr, edition } = passage.source;
  const book = { author, title: titleEn ?? titleAr ?? "" };
  const { page, volume } = passage;
  if (page) {
    // "101–111" is a range of pages: "pp." rather than "p.".
    const range = /[–-]/.test(page);
    if (volume) {
      return {
        key: range ? "volumePages" : "volumePage",
        values: { ...book, volume, page },
        edition,
      };
    }
    return { key: range ? "pages" : "page", values: { ...book, page }, edition };
  }
  const verse = passage.verse ? verseKey(passage.verse) : "";
  return { key: "verse", values: { ...book, verse }, edition };
}
