import { describe, expect, it } from "vitest";
import type {
  ContentItem,
  Explanation,
  Passage,
  SurahContent,
  Verse,
  VerseText,
} from "@/lib/domain/content";
import {
  buildSurahPageView,
  citedPassageIds,
  explanationView,
  formatRange,
  passageLabel,
  referencedVerses,
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
    transliterationStatus: { en: null, ko: null },
  };
}

const span = (from: number, to: number) => ({
  start: { surah: 1, ayah: from, word: null },
  end: { surah: 1, ayah: to, word: null },
});

const cite = (passageId: string, quoting: string | null = null) => ({ passageId, quoting });

const point = (label: string, ...citations: ReturnType<typeof cite>[]): ContentItem => ({
  text: { en: `[${label}]`, ko: `[${label} ko]` },
  citations,
});

function explanation(overrides: Partial<Explanation> = {}): Explanation {
  return {
    id: "e",
    kind: "reading_section",
    status: "published",
    span: span(1, 1),
    parts: {
      wordMeanings: [point("word meanings", cite("p1"))],
      background: [],
      context: [point("meaning", cite("p1"))],
      relatedVerses: [],
    },
    contextLinks: [],
    passageIds: ["p1"],
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
    summary: { en: null, ko: null },
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
  verses[1].transliterationStatus = { en: "published", ko: null };
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
    brief: {
      status: "published",
      items: [point("brief 1", cite("p2")), point("brief 2", cite("p3"), cite("p2"))],
    },
    verses,
    wordMeanings: [
      {
        word: { surah: 1, ayah: 2, word: 1 },
        status: "published",
        meaning: { en: "[meaning of 1:2:1]", ko: "[1:2:1 뜻]" },
        citations: [cite("p2", "[narrator]")],
        elsewhere: [
          { verse: { surah: 5, ayah: 7 }, text: { en: "[in 5:7]", ko: "[5:7]" } },
          { verse: { surah: 1, ayah: 3 }, text: { en: "[in 1:3]", ko: "[1:3]" } },
          { verse: null, text: { en: "[usage]", ko: "[용례]" } },
        ],
      },
    ],
    readingSections: [
      {
        position: 1,
        span: span(1, 2),
        explanation: explanation({
          span: span(1, 2),
          parts: {
            wordMeanings: [],
            background: [point("background", cite("p1"))],
            context: [point("meaning a", cite("p2"), cite("p1", "[narrator]"))],
            relatedVerses: [
              { verse: { surah: 4, ayah: 69 }, ...point("why 4:69", cite("p3")) },
              { verse: { surah: 1, ayah: 3 }, ...point("why 1:3") },
            ],
          },
          passageIds: ["p1", "p2", "p3"],
        }),
      },
      { position: 2, span: span(3, 3), explanation: null },
    ],
  };
}

const verseTexts: VerseText[] = [{ surah: 1, ayah: 3, textAr: "طظع" }];

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
  const passages = new Map(["p1", "p2", "p3"].map((id) => [id, passage(id)]));

  it("shows meaning (context), background and related verses, never the word meanings part", () => {
    const view = explanationView(explanation(), passages);
    expect(view?.meaning.map((item) => item.text.en)).toEqual(["[meaning]"]);
    expect(JSON.stringify(view)).not.toContain("[word meanings]");
  });

  it("is null when only the word meanings part is written, so the page says coming soon", () => {
    const view = explanationView(
      explanation({
        parts: {
          wordMeanings: [point("word meanings", cite("p1"))],
          background: [],
          context: [],
          relatedVerses: [],
        },
      }),
      passages,
    );
    expect(view).toBeNull();
  });

  it("numbers each passage where it is first cited, in the order the parts are shown", () => {
    const section = content().readingSections[0].explanation!;
    const view = explanationView(section, passages)!;
    const numbers = (sources: { number: number; passage: Passage; quoting: string | null }[]) =>
      sources.map((s) => [s.number, s.passage.id, s.quoting]);
    // Meaning comes first on the page, so its passages are 1 and 2.
    expect(numbers(view.meaning[0].sources)).toEqual([
      [1, "p2", null],
      [2, "p1", "[narrator]"],
    ]);
    expect(numbers(view.background[0].sources)).toEqual([[2, "p1", null]]);
    expect(numbers(view.relatedVerses[0].sources)).toEqual([[3, "p3", null]]);
  });

  it("leaves out a citation of a passage readers can't see", () => {
    const view = explanationView(
      explanation({ parts: { ...explanation().parts, context: [point("x", cite("hidden"))] } }),
      passages,
    );
    expect(view?.meaning[0].sources).toEqual([]);
  });

  it("links a related verse only once that verse is imported", () => {
    const view = explanationView(
      content().readingSections[0].explanation!,
      passages,
      new Set(["1:3"]),
    )!;
    expect(view.relatedVerses.map((r) => r.verse)).toEqual([
      { label: "4:69", surah: 4, anchor: "verse-4-69", available: false },
      { label: "1:3", surah: 1, anchor: "verse-1-3", available: true },
    ]);
  });
});

describe("buildSurahPageView", () => {
  const view = buildSurahPageView(
    content(),
    ["p1", "p2", "p3"].map((id) => passage(id)),
    verseTexts,
  );

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

  it("numbers the brief's sources within the brief", () => {
    expect(view.brief?.items.map((p) => p.sources.map((s) => [s.number, s.passage.id]))).toEqual([
      [[1, "p2"]],
      [
        [2, "p3"],
        [1, "p2"],
      ],
    ]);
  });

  it("keeps each verse's published transliteration", () => {
    expect(view.sections[0].verses[1].transliteration).toEqual({ en: "[latin 1:2]", ko: null });
  });

  it("describes the words that have a meaning for the popover", () => {
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
      sources: [{ number: 1, passage: { id: "p2" }, quoting: "[narrator]" }],
    });
  });

  it("shows the owner's elsewhere notes, with the verse's Arabic once that verse is imported", () => {
    expect(view.words["1:2:1"].elsewhere).toEqual([
      {
        verse: { label: "5:7", surah: 5, anchor: "verse-5-7", available: false },
        verseAr: null,
        text: { en: "[in 5:7]", ko: "[5:7]" },
      },
      {
        verse: { label: "1:3", surah: 1, anchor: "verse-1-3", available: true },
        verseAr: "طظع",
        text: { en: "[in 1:3]", ko: "[1:3]" },
      },
      { verse: null, verseAr: null, text: { en: "[usage]", ko: "[용례]" } },
    ]);
  });

  it("marks nothing as a draft when everything is published", () => {
    expect(view.sections.map((s) => s.draft)).toEqual([false, false]);
    expect(view.brief?.draft).toBe(false);
    expect(view.words["1:2:1"].draft).toBe(false);
    expect(view.sections[0].verses[1].transliterationDraft).toEqual({ en: false, ko: false });
  });

  it("marks what a tester sees in review as a draft", () => {
    const preview = content();
    preview.readingSections[1].explanation = explanation({
      id: "draft-section",
      status: "ko_drafted",
      span: span(3, 3),
    });
    preview.brief!.status = "en_approved";
    preview.wordMeanings[0].status = "ko_drafted";
    preview.verses[2].transliteration = { en: "[latin draft 1:3]", ko: null };
    preview.verses[2].transliterationStatus = { en: "draft", ko: null };
    const draftView = buildSurahPageView(preview, [passage("p1")], []);

    expect(draftView.sections.map((s) => [s.label, s.published, s.draft])).toEqual([
      ["1:1–2", true, false],
      ["1:3", false, true],
    ]);
    expect(draftView.sections[1].explanation?.meaning[0].text.en).toBe("[meaning]");
    expect(draftView.brief?.draft).toBe(true);
    expect(draftView.words["1:2:1"].draft).toBe(true);
    expect(draftView.sections[1].verses[0].transliterationDraft).toEqual({ en: true, ko: false });
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
  it("asks for every passage cited by explanations, word meanings and the brief, once, sorted", () => {
    expect(citedPassageIds(content())).toEqual(["p1", "p2", "p3"]);
  });

  it("asks for every verse it refers to, once, in text order", () => {
    expect(referencedVerses(content())).toEqual([
      { surah: 1, ayah: 3 },
      { surah: 4, ayah: 69 },
      { surah: 5, ayah: 7 },
    ]);
  });
});

describe("passageLabel", () => {
  it("names a passage by author and title, then volume and page(s), or verse", () => {
    const book = { author: "[Author]", title: "[Source title]" };
    expect(passageLabel(passage("a", { volume: "1", page: "70" }))).toEqual({
      key: "volumePage",
      values: { ...book, volume: "1", page: "70" },
    });
    expect(passageLabel(passage("b", { volume: "1", page: "101–111" }))).toEqual({
      key: "volumePages",
      values: { ...book, volume: "1", page: "101–111" },
    });
    expect(passageLabel(passage("c", { page: "9–24" }))).toEqual({
      key: "pages",
      values: { ...book, page: "9–24" },
    });
    expect(passageLabel(passage("d", { page: null, verse: { surah: 1, ayah: 4 } }))).toEqual({
      key: "verse",
      values: { ...book, verse: "1:4" },
    });
  });
});
