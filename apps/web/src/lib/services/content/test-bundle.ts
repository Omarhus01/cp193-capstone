import type { ReviewStatus } from "@/lib/domain/content";
import type { ReviewEntry } from "@/lib/services/review";
import type { ContentBundle, SurahFiles } from "./load";
import type { ExplanationEntry, WordMeaningEntry } from "./schema";

// A small valid bundle for tests. Its "verses" are made-up Arabic letter strings, not Quran text,
// and every explanation is a neutral placeholder: no religious content.

const WORDS = ["ابت", "ثجح", "خدذ", "رزس"];

function surahFiles(number: number, verseCount: number): SurahFiles {
  const verses = Array.from({ length: verseCount }, (_, i) => ({
    ayah: i + 1,
    text: WORDS.join(" "),
  }));
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
  };
}

const PUBLISHED_HISTORY: ReviewEntry[] = [
  { status: "en_approved", reviewer: "Reviewer A", date: "2026-10-01" },
  { status: "ko_drafted", reviewer: "Reviewer B", date: "2026-10-02" },
  { status: "ko_approved", reviewer: "Reviewer B", date: "2026-10-03" },
  { status: "published", reviewer: "Owner", date: "2026-10-04" },
];

/** Placeholder text in both languages. */
const both = (label: string) => ({ en: `${label} (en)`, ko: `${label} (ko)` });
const empty = { en: null, ko: null };

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
      wordMeanings: empty,
      background: published ? both(`background of ${id}`) : empty,
      context: published ? both(`context of ${id}`) : empty,
      connectedVerses: empty,
    },
    citations: published ? ["passage-1"] : [],
    contextLinks: [],
    status,
    review: published ? PUBLISHED_HISTORY : [],
  };
}

export function wordMeaning(word: string, status: ReviewStatus = "published"): WordMeaningEntry {
  const published = status === "published";
  return {
    word,
    meaning: published ? both(`meaning of ${word}`) : empty,
    citations: published ? ["passage-1"] : [],
    status,
    review: published ? PUBLISHED_HISTORY : [],
  };
}

/**
 * Surah 1 with 4 verses and surah 2 with 3, one source with two passages, two reading sections
 * covering surah 1, a phrase note with a context link into surah 2, a published word meaning,
 * a published brief, and a draft verse explanation.
 */
export function testBundle(): ContentBundle {
  const first = surahFiles(1, 4);
  const second = surahFiles(2, 3);
  first.explanations = [
    explanation("s1-reading-1", "reading_section", "1:1", "1:2"),
    explanation("s1-reading-2", "reading_section", "1:3", "1:4"),
    {
      ...explanation("s1-note", "phrase_note", "1:2:2", "1:2:3"),
      contextLinks: [{ span: { from: "2:1", to: "2:2" }, reason: both("why 2:1-2:2") }],
    },
    explanation("s1-draft", "verse_explanation", "1:3", "1:3", "draft"),
  ];
  first.readingSections = ["s1-reading-1", "s1-reading-2"];
  first.wordMeanings = [wordMeaning("1:1:1"), wordMeaning("1:1:2", "draft")];
  first.surah = {
    names: { en: "Test", ko: "테스트" },
    brief: { ...both("brief"), status: "published", review: PUBLISHED_HISTORY },
  };
  return {
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
          },
          {
            id: "passage-2",
            volume: null,
            page: null,
            verse: "2:1",
            textAr: null,
            summary: both("passage 2"),
          },
        ],
      },
    ],
  };
}
