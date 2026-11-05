import type { ContentBundle, SurahFiles } from "../../src/lib/services/content/load";
import type { ItemEntry } from "../../src/lib/services/content/schema";
import {
  explanation,
  question,
  testMetadata,
  transliteration,
  wordMeaning,
} from "../../src/lib/services/content/test-bundle";

// Content the surah page e2e tests seed into a local Supabase. The "verses" are made-up Arabic
// letter strings and every text is a bracketed placeholder: no Quran text, translation or
// explanation.

/** A pause mark, which Tanzil writes as its own token and which isn't a word. */
export const PAUSE_MARK = "ۛ";

export const FIXTURE_ROOT = "ا ب ت";

const WORDS = ["ابت", "ثجح", "خدذ", "رزس"];

function surahFiles(number: number, verseCount: number): SurahFiles {
  const verses = Array.from({ length: verseCount }, (_, i) => ({
    ayah: i + 1,
    // Verse 2 of surah 1 has a pause mark between its first two words.
    text:
      number === 1 && i === 1
        ? [WORDS[0], PAUSE_MARK, ...WORDS.slice(1)].join(" ")
        : WORDS.join(" "),
  }));
  return {
    number,
    dir: `surahs/${String(number).padStart(3, "0")}`,
    text: {
      attribution: "fixture",
      surah: { number, nameAr: "اختبار", revelationPlace: "meccan", verseCount, basmala: null },
      verses,
    },
    words: {
      attribution: "fixture",
      verses: verses.map(({ ayah }) => ({
        ayah,
        words: WORDS.map((text, i) => ({
          position: i + 1,
          text,
          root: i === 0 ? FIXTURE_ROOT : null,
        })),
      })),
    },
    surah: { names: { en: `[Fixture surah ${number}]`, ko: `[픽스처 수라 ${number}]` } },
    explanations: [],
    readingSections: [],
    wordMeanings: [],
    transliterations: [],
    qa: [],
  };
}

const both = (label: string) => ({ en: `[${label} en]`, ko: `[${label} ko]` });

/** A point with its sources. */
const point = (label: string, citations: ItemEntry["citations"]): ItemEntry => ({
  ...both(label),
  citations,
});

/** The name the fixture's quoting citations give. */
export const FIXTURE_NARRATOR = "[Fixture narrator]";

/** fx-passage-1 links here; fx-passage-2 has no link. */
export const FIXTURE_PASSAGE_URL = "https://example.com/fixture-book/1/10";

/**
 * Surah 1 (5 verses) in three reading sections:
 * - 1:1–2, published: two meaning points (the first with **bold**, *italic*, and two sources, one
 *   of them quoting), a background point, a word meanings part (never shown), and related verses
 *   2:1 (imported, so a link) and 40:6 (not imported, so text)
 * - 1:3, a draft: "explanation coming soon"
 * - 1:4–5, published, with one meaning point
 * Word meanings: 1:1:1 with elsewhere notes (2:1, and one without a verse); 1:2:2 with none.
 * Transliterations: 1:1 in both languages, 1:4 in Korean only, 1:2 a Latin draft (hidden).
 * Fixed questions: two about 1:1–2 (the first citing the linked passage, the second quoting through
 * the other), one about 1:4–5, and a draft about 1:3 (hidden).
 */
export function fixtureBundle(): ContentBundle {
  const first = surahFiles(1, 5);
  const second = surahFiles(2, 3);

  const full = explanation("fx-reading-1", "reading_section", "1:1", "1:2");
  full.parts = {
    wordMeanings: [point("word meanings part", ["fx-passage-1"])],
    background: [point("background 1", ["fx-passage-1"])],
    context: [
      {
        en: "[meaning 1a en] with **bold** and *italic*",
        ko: "[meaning 1a ko] with **bold** and *italic*",
        citations: ["fx-passage-1", { passage: "fx-passage-2", quoting: FIXTURE_NARRATOR }],
      },
      point("meaning 1b", ["fx-passage-2"]),
    ],
    connectedVerses: [
      { verse: "2:1", ...point("why 2:1", ["fx-passage-1"]) },
      { verse: "40:6", ...point("why 40:6", ["fx-passage-2"]) },
    ],
  };

  const short = explanation("fx-reading-3", "reading_section", "1:4", "1:5");
  short.parts = {
    ...short.parts,
    background: [],
    context: [point("meaning 3", ["fx-passage-1"])],
  };

  first.explanations = [
    full,
    explanation("fx-reading-2", "reading_section", "1:3", "1:3", "draft"),
    short,
  ];
  first.readingSections = ["fx-reading-1", "fx-reading-2", "fx-reading-3"];
  first.wordMeanings = [
    {
      ...wordMeaning("1:1:1"),
      meaning: both("meaning of 1:1:1"),
      citations: ["fx-passage-1", { passage: "fx-passage-2", quoting: FIXTURE_NARRATOR }],
      elsewhere: [
        { verse: "2:1", ...both("elsewhere in 2:1") },
        { verse: null, ...both("usage note") },
      ],
    },
    { ...wordMeaning("1:2:2"), meaning: both("meaning of 1:2:2"), citations: ["fx-passage-2"] },
  ];
  first.transliterations = [
    { ...transliteration("1:1", "en"), text: "[latin 1:1]" },
    { ...transliteration("1:1", "ko"), text: "[hangul 1:1]" },
    transliteration("1:2", "en", "draft"),
    { ...transliteration("1:4", "ko"), text: "[hangul 1:4]" },
  ];
  const ask = (n: number, from: string, to: string, citations: ItemEntry["citations"]) => ({
    ...question(`fx-qa-${n}`, from, to, "published", citations),
    question: both(`question ${n}`),
    answer: both(`answer ${n}`),
  });
  first.qa = [
    ask(1, "1:1", "1:2", ["fx-passage-1"]),
    ask(2, "1:2", "1:2", [{ passage: "fx-passage-2", quoting: FIXTURE_NARRATOR }]),
    ask(3, "1:4", "1:5", ["fx-passage-1"]),
    question("fx-qa-draft", "1:3", "1:3", "draft", ["fx-passage-1"]),
  ];
  first.surah = {
    names: first.surah.names,
    brief: {
      items: [
        point("brief 1", ["fx-passage-1"]),
        point("brief 2", [{ passage: "fx-passage-2", quoting: FIXTURE_NARRATOR }]),
      ],
      status: "published",
      review: full.review.map((entry) => ({ ...entry })),
    },
  };
  second.wordMeanings = [
    { ...wordMeaning("2:1:1"), meaning: both("meaning of 2:1:1"), citations: ["fx-passage-1"] },
  ];

  return {
    metadata: testMetadata([first, second]),
    surahs: [first, second],
    sources: [
      {
        file: "sources/fx-source.json",
        source: {
          id: "fx-source",
          titleAr: null,
          titleEn: "[Fixture source]",
          author: "[Fixture author]",
          edition: "[Fixture edition]",
          type: "tafsir",
        },
        passages: [
          {
            id: "fx-passage-1",
            volume: "1",
            page: "10",
            verse: null,
            textAr: null,
            summary: both("passage 1"),
            url: FIXTURE_PASSAGE_URL,
          },
          {
            id: "fx-passage-2",
            volume: null,
            page: null,
            verse: "1:2",
            textAr: null,
            summary: both("passage 2"),
            url: null,
          },
        ],
      },
    ],
  };
}
