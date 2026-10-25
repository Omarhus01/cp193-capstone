import type {
  Explanation,
  Localized,
  Passage,
  ReadingSectionSummary,
  RootWordMeaning,
  Span,
  Surah,
  SurahContent,
  Verse,
  VerseRef,
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

export type CitationView = { number: number; passage: Passage };

export type RelatedVerseView = {
  /** "4:69" or "4:69–70" */
  label: string;
  surah: number;
  anchor: string;
  reason: Localized;
};

/** The parts of an explanation that readers see. A part that isn't written is null. */
export type ExplanationView = {
  meaning: Localized | null;
  background: Localized | null;
  relatedVerses: Localized | null;
  relatedVerseLinks: RelatedVerseView[];
  citations: CitationView[];
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
  /** Null when there is nothing to show yet: the page says the explanation is coming soon. */
  explanation: ExplanationView | null;
};

export type ElsewhereMeaning = {
  ref: VerseRef & { word: number };
  label: string;
  anchor: string;
  verseAr: string;
  meaning: Localized;
};

/** What the word popover shows. */
export type WordDetail = {
  /** "1:4:2" */
  key: string;
  ref: VerseRef & { word: number };
  textAr: string;
  root: string | null;
  meaning: Localized;
  sources: Passage[];
  elsewhere: ElsewhereMeaning[];
};

export type SurahPageView = {
  surah: Surah;
  brief: Localized | null;
  sections: SectionView[];
  /** Keyed by "surah:ayah:word". Only words with a published meaning are here. */
  words: Record<string, WordDetail>;
};

export const wordKey = ({ surah, ayah, word }: VerseRef & { word: number }) =>
  `${surah}:${ayah}:${word}`;

export const verseAnchor = ({ surah, ayah }: VerseRef) => `verse-${surah}-${ayah}`;

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

const written = (text: Localized): Localized | null => (text.en || text.ko ? text : null);

/** The explanation's visible parts, or null when none is written. Word meanings aren't shown. */
export function explanationView(
  explanation: Explanation,
  passages: ReadonlyMap<string, Passage>,
): ExplanationView | null {
  const { parts } = explanation;
  const view: ExplanationView = {
    meaning: written(parts.context),
    background: written(parts.background),
    relatedVerses: written(parts.connectedVerses),
    relatedVerseLinks: explanation.contextLinks.map(({ span, reason }) => ({
      label: formatRange(span),
      surah: span.start.surah,
      anchor: verseAnchor(span.start),
      reason,
    })),
    citations: explanation.passageIds
      .flatMap((id) => passages.get(id) ?? [])
      .map((passage, i) => ({ number: i + 1, passage })),
  };
  const visible =
    view.meaning || view.background || view.relatedVerses || view.relatedVerseLinks.length > 0;
  return visible ? view : null;
}

/** A surah without reading sections still shows every verse: one block per verse. */
function sectionsOf(content: SurahContent): ReadingSectionSummary[] {
  if (content.readingSections.length > 0) {
    return content.readingSections;
  }
  return content.verses.map((verse) => ({
    position: verse.ayah,
    span: {
      start: { surah: verse.surah, ayah: verse.ayah, word: null },
      end: { surah: verse.surah, ayah: verse.ayah, word: null },
    },
    explanation: null,
  }));
}

/** Builds the page from published content, the passages it cites, and meanings by root. */
export function buildSurahPageView(
  content: SurahContent,
  passages: readonly Passage[],
  rootMeanings: readonly RootWordMeaning[],
): SurahPageView {
  const passagesById = new Map(passages.map((passage) => [passage.id, passage]));
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
      explanation: section.explanation ? explanationView(section.explanation, passagesById) : null,
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
        sources: meaning.passageIds.flatMap((id) => passagesById.get(id) ?? []),
        elsewhere: rootMeanings
          .filter((other) => other.root === word.root && wordKey(other.word) !== key)
          .map((other) => ({
            ref: other.word,
            label: `${other.word.surah}:${other.word.ayah}`,
            anchor: verseAnchor(other.word),
            verseAr: other.verseAr,
            meaning: other.meaning,
          })),
      };
    }
  }

  return { surah: content.surah, brief: content.brief, sections: sectionViews, words };
}

/** The ids of every passage cited on the page, sorted, so the same page asks the same question. */
export function citedPassageIds(content: SurahContent): string[] {
  const ids = new Set([
    ...content.readingSections.flatMap((section) => section.explanation?.passageIds ?? []),
    ...content.wordMeanings.flatMap((meaning) => meaning.passageIds),
  ]);
  return [...ids].sort();
}

/** The roots of the words that have a published meaning, sorted. */
export function rootsWithMeanings(content: SurahContent): string[] {
  const roots = new Set<string>();
  for (const { word } of content.wordMeanings) {
    const root = content.verses
      .find((verse) => verse.ayah === word.ayah)
      ?.words.find((w) => w.position === word.word)?.root;
    if (root) {
      roots.add(root);
    }
  }
  return [...roots].sort();
}

/** How a passage is named in a source link: a message key of "surah.passage" and its values. */
export function passageLabel(passage: Passage): {
  key: "volumePage" | "page" | "verse";
  values: Record<string, string>;
} {
  const title = passage.source.titleEn ?? passage.source.titleAr ?? passage.source.author;
  if (passage.page) {
    return passage.volume
      ? { key: "volumePage", values: { title, volume: passage.volume, page: passage.page } }
      : { key: "page", values: { title, page: passage.page } };
  }
  const verse = passage.verse ? `${passage.verse.surah}:${passage.verse.ayah}` : "";
  return { key: "verse", values: { title, verse } };
}
