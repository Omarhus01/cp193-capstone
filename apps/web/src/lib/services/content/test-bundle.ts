import type { ReviewStatus } from "@/lib/domain/content";
import type { ReviewEntry } from "@/lib/services/review";
import type { ContentBundle, SurahFiles } from "./load";
import type { SurahMetadata } from "./schema";
import type {
  ExplanationEntry,
  ItemEntry,
  QaEntry,
  TransliterationEntry,
  WordMeaningEntry,
} from "./schema";

// A small valid bundle for tests. Its "verses" are made-up Arabic letter strings, not Quran text,
// and every explanation is a neutral placeholder: no religious content.

const WORDS = ["ابت", "ثجح", "خدذ", "رزس"];

/** A surah folder holding `ayahs` (every verse unless given) of a surah of `verseCount` verses. */
function surahFiles(
  number: number,
  verseCount: number,
  ayahs: readonly number[] = Array.from({ length: verseCount }, (_, i) => i + 1),
): SurahFiles {
  const verses = ayahs.map((ayah) => ({ ayah, text: WORDS.join(" ") }));
  return {
    number,
    dir: `surahs/${String(number).padStart(3, "0")}`,
    text: {
      attribution: "test",
      surah: { number, nameAr: "اختبار", revelationPlace: "meccan", verseCount, basmala: null },
      verses,
    },
    words: {
      attribution: "test",
      verses: verses.map(({ ayah }) => ({
        ayah,
        words: WORDS.map((text, i) => ({ position: i + 1, text, root: null })),
      })),
    },
    surah: { names: { en: "Test", ko: "테스트" } },
    explanations: [],
    readingSections: [],
    wordMeanings: [],
    transliterations: [],
    qa: [],
  };
}

const PUBLISHED_HISTORY: ReviewEntry[] = [
  { status: "en_approved", reviewer: "Reviewer A", date: "2026-10-01" },
  { status: "ko_drafted", reviewer: "Reviewer B", date: "2026-10-02" },
  { status: "ko_approved", reviewer: "Reviewer B", date: "2026-10-03" },
  { status: "published", reviewer: "Owner", date: "2026-10-04" },
];

/** A fresh copy for each item, so a test that changes one history doesn't change the others. */
const publishedHistory = () => PUBLISHED_HISTORY.map((entry) => ({ ...entry }));

/** Placeholder text in both languages. */
const both = (label: string) => ({ en: `${label} (en)`, ko: `${label} (ko)` });
const empty = { en: null, ko: null };

/** A point of an explanation or brief, citing passage-1 unless told otherwise. */
export function item(label: string, citations: ItemEntry["citations"] = ["passage-1"]): ItemEntry {
  return { ...both(label), citations };
}

export function explanation(
  id: string,
  kind: ExplanationEntry["kind"],
  from: string,
  to: string,
  status: ReviewStatus = "published",
): ExplanationEntry {
  const published = status === "published";
  return {
    id,
    kind,
    span: { from, to },
    parts: {
      wordMeanings: [],
      background: published ? [item(`background of ${id}`)] : [],
      context: published ? [item(`context of ${id}`)] : [],
      connectedVerses: [],
    },
    contextLinks: [],
    status,
    review: published ? publishedHistory() : [],
  };
}

export function wordMeaning(word: string, status: ReviewStatus = "published"): WordMeaningEntry {
  const published = status === "published";
  return {
    word,
    meaning: published ? both(`meaning of ${word}`) : empty,
    citations: published ? ["passage-1"] : [],
    elsewhere: [],
    status,
    review: published ? publishedHistory() : [],
  };
}

export function transliteration(
  verse: string,
  language: TransliterationEntry["language"],
  status: ReviewStatus = "published",
): TransliterationEntry {
  const approved = language === "en" ? "en_approved" : "ko_approved";
  const review: ReviewEntry[] =
    status === "draft"
      ? []
      : [
          { status: approved, reviewer: "Reviewer", date: "2026-10-01" },
          ...(status === "published"
            ? [{ status: "published" as const, reviewer: "Owner", date: "2026-10-02" }]
            : []),
        ];
  return {
    verse,
    language,
    text: status === "draft" ? null : `pronunciation of ${verse} (${language})`,
    status,
    review,
  };
}

/** A fixed question about whole verses, its answer citing passage-1 unless told otherwise. */
export function question(
  id: string,
  from: string,
  to: string,
  status: ReviewStatus = "published",
  citations: QaEntry["citations"] = ["passage-1"],
): QaEntry {
  const published = status === "published";
  return {
    id,
    span: { from, to },
    question: published ? both(`question ${id}`) : { en: `question ${id} (en)`, ko: null },
    answer: published ? both(`answer ${id}`) : { en: `answer ${id} (en)`, ko: null },
    citations,
    status,
    review: published ? publishedHistory() : [],
  };
}

/**
 * Metadata for all 114 surahs, like quran-metadata.json, matching the given surahs' text. The
 * others get 10 verses, so references to surahs that aren't imported can be tested.
 */
export function testMetadata(surahs: readonly SurahFiles[]): SurahMetadata[] {
  return Array.from({ length: 114 }, (_, i) => {
    const text = surahs.find((surah) => surah.number === i + 1)?.text.surah;
    return {
      number: i + 1,
      nameAr: text?.nameAr ?? "اختبار",
      revelationPlace: text?.revelationPlace ?? "meccan",
      verseCount: text?.verseCount ?? 10,
    };
  });
}

/**
 * Surah 1 with 4 verses and surah 2 with 3, one source with two passages, two reading sections
 * covering surah 1, a phrase note with a context link into surah 2, a published word meaning,
 * a published brief, a draft verse explanation, transliterations of 1:1 (published in both
 * languages) and 1:2 (a draft in Latin), and fixed questions: two published (1:1–1:2 and 1:3) and
 * a draft.
 */
export function testBundle(): ContentBundle {
  const first = surahFiles(1, 4);
  const second = surahFiles(2, 3);
  first.explanations = [
    {
      ...explanation("s1-reading-1", "reading_section", "1:1", "1:2"),
      // A related verse in a surah that isn't imported, quoting someone through passage-2.
      parts: {
        wordMeanings: [],
        background: [item("background of s1-reading-1")],
        context: [
          item("context of s1-reading-1", [
            "passage-1",
            { passage: "passage-2", quoting: "[narrator]" },
          ]),
        ],
        connectedVerses: [{ verse: "3:5", ...item("why 3:5") }],
      },
    },
    explanation("s1-reading-2", "reading_section", "1:3", "1:4"),
    {
      ...explanation("s1-note", "phrase_note", "1:2:2", "1:2:3"),
      contextLinks: [{ span: { from: "2:1", to: "2:2" }, reason: both("why 2:1-2:2") }],
    },
    explanation("s1-draft", "verse_explanation", "1:3", "1:3", "draft"),
  ];
  first.readingSections = ["s1-reading-1", "s1-reading-2"];
  first.wordMeanings = [
    { ...wordMeaning("1:1:1"), elsewhere: [{ verse: "2:3", ...both("elsewhere in 2:3") }] },
    wordMeaning("1:1:2", "draft"),
  ];
  first.transliterations = [
    transliteration("1:1", "en"),
    transliteration("1:1", "ko"),
    transliteration("1:2", "en", "draft"),
  ];
  first.qa = [
    question("s1-qa-1", "1:1", "1:2"),
    question("s1-qa-2", "1:3", "1:3", "published", [
      "passage-2",
      { passage: "passage-1", quoting: "[narrator]" },
    ]),
    question("s1-qa-draft", "1:4", "1:4", "draft"),
  ];
  first.surah = {
    names: { en: "Test", ko: "테스트" },
    brief: {
      items: [item("brief paragraph 1"), item("brief paragraph 2", ["passage-2"])],
      status: "published",
      review: publishedHistory(),
    },
  };
  return {
    metadata: testMetadata([first, second, partialSurah()]),
    surahs: [first, second],
    sources: [
      {
        file: "sources/source-1.json",
        source: {
          id: "source-1",
          titleAr: null,
          titleEn: "Test source",
          author: "Test author",
          edition: null,
          type: "tafsir",
        },
        passages: [
          {
            id: "passage-1",
            volume: "1",
            page: "10",
            verse: null,
            textAr: null,
            summary: both("passage 1"),
            url: "https://example.com/book/1/10",
          },
          {
            id: "passage-2",
            volume: null,
            page: null,
            verse: "2:1",
            textAr: null,
            summary: both("passage 2"),
            url: null,
          },
        ],
      },
    ],
  };
}

/**
 * Surah 4 (176 verses) holding only verses 34, 35 and 40 (ADR 0022), in two reading sections:
 * 4:34–35 and 4:40. Not part of testBundle; add it with `withPartialSurah`.
 */
export function partialSurah(): SurahFiles {
  const surah = surahFiles(4, 176, [34, 35, 40]);
  surah.explanations = [
    explanation("s4-reading-1", "reading_section", "4:34", "4:35"),
    explanation("s4-reading-2", "reading_section", "4:40", "4:40"),
  ];
  surah.readingSections = ["s4-reading-1", "s4-reading-2"];
  return surah;
}

/** The test bundle with the partial surah 4 added. */
export function withPartialSurah(): ContentBundle {
  const bundle = testBundle();
  bundle.surahs.push(partialSurah());
  return bundle;
}
