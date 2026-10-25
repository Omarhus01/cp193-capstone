import { describe, expect, it } from "vitest";
import type {
  Explanation,
  Passage,
  RootWordMeaning,
  SurahContent,
  Verse,
} from "@/lib/domain/content";
import {
  buildSurahPageView,
  citedPassageIds,
  explanationView,
  formatRange,
  passageLabel,
  rootsWithMeanings,
  toArabicDigits,
  verseTokens,
} from "./surah-view";

// Made-up Arabic letter strings and placeholder text, not Quran text or explanations.

const MARK = "ۛ"; // a pause mark, which Tanzil writes as its own token

function verse(ayah: number, words: string[], text = words.join(" ")): Verse {
  return {
    surah: 1,
    ayah,
    textAr: text,
    words: words.map((textAr, i) => ({ position: i + 1, textAr, root: null })),
    transliteration: { en: null, ko: null },
  };
}

const span = (from: number, to: number) => ({
  start: { surah: 1, ayah: from, word: null },
  end: { surah: 1, ayah: to, word: null },
});

const empty = { en: null, ko: null };

function explanation(overrides: Partial<Explanation> = {}): Explanation {
  return {
    id: "e",
    kind: "reading_section",
    span: span(1, 1),
    parts: {
      wordMeanings: { en: "[word meanings]", ko: "[단어]" },
      background: empty,
      context: { en: "[meaning]", ko: "[의미]" },
      connectedVerses: empty,
    },
    contextLinks: [],
    passageIds: [],
    ...overrides,
  };
}

function passage(id: string, overrides: Partial<Passage> = {}): Passage {
  return {
    id,
    source: {
      id: "src",
      titleAr: null,
      titleEn: "[Source title]",
      author: "[Author]",
      edition: null,
      type: "tafsir",
    },
    volume: null,
    page: "10",
    verse: null,
    textAr: null,
    summary: empty,
    ...overrides,
  };
}

function content(): SurahContent {
  const verses = [
    verse(1, ["ابت", "ثجح"]),
    verse(2, ["خدذ", "رزس", "شصض"], `خدذ ${MARK} رزس شصض`),
    verse(3, ["طظع"]),
  ];
  verses[1].words[0].root = "خ د ذ";
  verses[1].transliteration = { en: "[latin 1:2]", ko: null };
  return {
    surah: {
      number: 1,
      nameAr: "اختبار",
      nameEn: "[Test]",
      nameKo: "[테스트]",
      revelationPlace: "meccan",
      verseCount: 3,
      basmalaAr: null,
    },
    brief: null,
    verses,
    wordMeanings: [
      {
        word: { surah: 1, ayah: 2, word: 1 },
        meaning: { en: "[meaning of 1:2:1]", ko: "[1:2:1 뜻]" },
        passageIds: ["p2"],
      },
    ],
    readingSections: [
      {
        position: 1,
        span: span(1, 2),
        explanation: explanation({ span: span(1, 2), passageIds: ["p2", "p1"] }),
      },
      { position: 2, span: span(3, 3), explanation: null },
    ],
  };
}

const rootMeanings: RootWordMeaning[] = [
  {
    word: { surah: 1, ayah: 2, word: 1 },
    meaning: { en: "[meaning of 1:2:1]", ko: "[1:2:1 뜻]" },
    passageIds: ["p2"],
    root: "خ د ذ",
    wordAr: "خدذ",
    verseAr: `خدذ ${MARK} رزس شصض`,
  },
  {
    word: { surah: 5, ayah: 7, word: 3 },
    meaning: { en: "[meaning of 5:7:3]", ko: "[5:7:3 뜻]" },
    passageIds: [],
    root: "خ د ذ",
    wordAr: "خدذي",
    verseAr: "ابت خدذي",
  },
];

describe("formatRange", () => {
  it("names one verse, several verses, and a range across surahs", () => {
    expect(formatRange(span(1, 1))).toBe("1:1");
    expect(formatRange(span(2, 4))).toBe("1:2–4");
    expect(
      formatRange({
        start: { surah: 1, ayah: 7, word: null },
        end: { surah: 2, ayah: 3, word: null },
      }),
    ).toBe("1:7–2:3");
  });
});

describe("toArabicDigits", () => {
  it("writes verse numbers in Arabic-Indic digits", () => {
    expect(toArabicDigits(4)).toBe("٤");
    expect(toArabicDigits(109)).toBe("١٠٩");
  });
});

describe("verseTokens", () => {
  it("keeps pause marks in place but doesn't count them as words", () => {
    const tokens = verseTokens(verse(2, ["خدذ", "رزس"], `خدذ ${MARK} رزس`), (p) => p === 2);
    expect(tokens).toEqual([
      { kind: "word", position: 1, textAr: "خدذ", hasMeaning: false },
      { kind: "mark", textAr: MARK },
      { kind: "word", position: 2, textAr: "رزس", hasMeaning: true },
    ]);
  });

  it("gives back the verse text exactly when joined with spaces", () => {
    const text = `خدذ ${MARK} رزس`;
    const tokens = verseTokens(verse(2, ["خدذ", "رزس"], text), () => false);
    expect(tokens.map((t) => t.textAr).join(" ")).toBe(text);
  });
});

describe("explanationView", () => {
  const passages = new Map([
    ["p1", passage("p1")],
    ["p2", passage("p2")],
  ]);

  it("shows meaning (context), background and related verses, never the word meanings part", () => {
    const view = explanationView(
      explanation({
        parts: {
          wordMeanings: { en: "[word meanings]", ko: "[단어]" },
          background: { en: "[background]", ko: "[배경]" },
          context: { en: "[meaning]", ko: "[의미]" },
          connectedVerses: { en: "[related]", ko: "[관련]" },
        },
      }),
      passages,
    );
    expect(view).toMatchObject({
      meaning: { en: "[meaning]" },
      background: { en: "[background]" },
      relatedVerses: { en: "[related]" },
    });
    expect(JSON.stringify(view)).not.toContain("[word meanings]");
  });

  it("is null when only the word meanings part is written, so the page says coming soon", () => {
    const view = explanationView(
      explanation({
        parts: {
          wordMeanings: { en: "[word meanings]", ko: "[단어]" },
          background: empty,
          context: empty,
          connectedVerses: empty,
        },
      }),
      passages,
    );
    expect(view).toBeNull();
  });

  it("numbers the citations in order and links related verses to their anchor", () => {
    const view = explanationView(
      explanation({
        passageIds: ["p2", "missing", "p1"],
        contextLinks: [
          {
            span: {
              start: { surah: 4, ayah: 69, word: null },
              end: { surah: 4, ayah: 70, word: null },
            },
            reason: { en: "[why]", ko: "[이유]" },
          },
        ],
      }),
      passages,
    );
    expect(view?.citations.map((c) => [c.number, c.passage.id])).toEqual([
      [1, "p2"],
      [2, "p1"],
    ]);
    expect(view?.relatedVerseLinks).toEqual([
      { label: "4:69–70", surah: 4, anchor: "verse-4-69", reason: { en: "[why]", ko: "[이유]" } },
    ]);
  });
});

describe("buildSurahPageView", () => {
  const view = buildSurahPageView(content(), [passage("p1"), passage("p2")], rootMeanings);

  it("lists every reading section, published or not, with its verses", () => {
    expect(view.sections.map((s) => [s.position, s.total, s.label, s.anchor, s.published])).toEqual(
      [
        [1, 2, "1:1–2", "section-1", true],
        [2, 2, "1:3", "section-2", false],
      ],
    );
    expect(view.sections[0].verses.map((v) => v.anchor)).toEqual(["verse-1-1", "verse-1-2"]);
    expect(view.sections[0].previewAr).toBe("ابت ثجح");
  });

  it("shows coming soon for a section whose explanation isn't published", () => {
    expect(view.sections[0].explanation).not.toBeNull();
    expect(view.sections[1].explanation).toBeNull();
  });

  it("keeps each verse's published transliteration", () => {
    expect(view.sections[0].verses[1].transliteration).toEqual({ en: "[latin 1:2]", ko: null });
  });

  it("marks the words that have a meaning and describes them for the popover", () => {
    const tokens = view.sections[0].verses[1].tokens;
    expect(tokens.filter((t) => t.kind === "word" && t.hasMeaning)).toEqual([
      { kind: "word", position: 1, textAr: "خدذ", hasMeaning: true },
    ]);
    expect(Object.keys(view.words)).toEqual(["1:2:1"]);
    expect(Object.keys(view.sections[0].words)).toEqual(["1:2:1"]);
    expect(view.sections[1].words).toEqual({});
    expect(view.words["1:2:1"]).toMatchObject({
      textAr: "خدذ",
      root: "خ د ذ",
      meaning: { en: "[meaning of 1:2:1]" },
      sources: [{ id: "p2" }],
    });
  });

  it("lists the root's meanings elsewhere, without the word itself", () => {
    expect(view.words["1:2:1"].elsewhere).toEqual([
      {
        ref: { surah: 5, ayah: 7, word: 3 },
        label: "5:7",
        anchor: "verse-5-7",
        verseAr: "ابت خدذي",
        meaning: { en: "[meaning of 5:7:3]", ko: "[5:7:3 뜻]" },
      },
    ]);
  });

  it("gives one block per verse to a surah without reading sections", () => {
    const withoutSections = { ...content(), readingSections: [] };
    const blocks = buildSurahPageView(withoutSections, [], []).sections;
    expect(blocks.map((s) => [s.label, s.published, s.explanation])).toEqual([
      ["1:1", false, null],
      ["1:2", false, null],
      ["1:3", false, null],
    ]);
  });
});

describe("what the page loads", () => {
  it("asks for every cited passage once, sorted", () => {
    expect(citedPassageIds(content())).toEqual(["p1", "p2"]);
  });

  it("asks for the roots of words with a meaning", () => {
    expect(rootsWithMeanings(content())).toEqual(["خ د ذ"]);
  });
});

describe("passageLabel", () => {
  it("names a passage by volume and page, by page, or by verse", () => {
    expect(passageLabel(passage("a", { volume: "1", page: "70" }))).toEqual({
      key: "volumePage",
      values: { title: "[Source title]", volume: "1", page: "70" },
    });
    expect(passageLabel(passage("b", { page: "12" }))).toEqual({
      key: "page",
      values: { title: "[Source title]", page: "12" },
    });
    expect(passageLabel(passage("c", { page: null, verse: { surah: 1, ayah: 4 } }))).toEqual({
      key: "verse",
      values: { title: "[Source title]", verse: "1:4" },
    });
  });
});
