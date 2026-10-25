import { describe, expect, it } from "vitest";
import {
  spanKeys,
  toExplanation,
  toBrief,
  toPassage,
  toVerse,
  toWordMeaning,
  type ExplanationRow,
  type SpanRow,
} from "./content-mappers";

const span = (
  id: string,
  start: [number, number, number | null],
  end: [number, number, number | null],
): SpanRow => ({
  id,
  start_surah: start[0],
  start_ayah: start[1],
  start_word: start[2],
  end_surah: end[0],
  end_ayah: end[1],
  end_word: end[2],
});

describe("spanKeys", () => {
  it("matches the database's generated columns", () => {
    expect(
      spanKeys({
        start: { surah: 2, ayah: 60, word: null },
        end: { surah: 2, ayah: 61, word: null },
      }),
    ).toEqual({ start: 2_060_000, end: 2_061_999 });
    expect(
      spanKeys({ start: { surah: 1, ayah: 2, word: 1 }, end: { surah: 1, ayah: 2, word: 3 } }),
    ).toEqual({ start: 1_002_001, end: 1_002_003 });
  });

  it("makes a whole verse overlap every phrase inside it", () => {
    const verse = spanKeys({
      start: { surah: 1, ayah: 2, word: null },
      end: { surah: 1, ayah: 2, word: null },
    });
    const phrase = spanKeys({
      start: { surah: 1, ayah: 2, word: 4 },
      end: { surah: 1, ayah: 2, word: 4 },
    });
    expect(verse.start <= phrase.end && phrase.start <= verse.end).toBe(true);
  });
});

describe("toExplanation", () => {
  const row: ExplanationRow = {
    id: "note",
    kind: "phrase_note",
    status: "ko_drafted",
    span: span("1:2:1-1:2:3", [1, 2, 1], [1, 2, 3]),
    explanation_item: [
      {
        part: "background",
        sort_order: 1,
        text_en: "second point (en)",
        text_ko: "second point (ko)",
        verse_surah: null,
        verse_ayah: null,
        explanation_item_citation: [],
      },
      {
        part: "background",
        sort_order: 0,
        text_en: "first point (en)",
        text_ko: "first point (ko)",
        verse_surah: null,
        verse_ayah: null,
        explanation_item_citation: [
          { sort_order: 1, passage_id: "second", quoting: "[narrator]" },
          { sort_order: 0, passage_id: "first", quoting: null },
        ],
      },
      {
        part: "connected_verses",
        sort_order: 0,
        text_en: "why (en)",
        text_ko: null,
        verse_surah: 40,
        verse_ayah: 16,
        explanation_item_citation: [],
      },
    ],
    explanation_citation: [
      { passage_id: "second", sort_order: 1 },
      { passage_id: "first", sort_order: 0 },
    ],
    context_link: [
      {
        sort_order: 1,
        reason_en: "b",
        reason_ko: null,
        span: span("2:1-2:1", [2, 1, null], [2, 1, null]),
      },
      {
        sort_order: 0,
        reason_en: "a",
        reason_ko: null,
        span: span("3:1-3:2", [3, 1, null], [3, 2, null]),
      },
    ],
  };

  it("maps each part's points in order, each with its citations in order", () => {
    const explanation = toExplanation(row);
    expect(explanation.parts.background).toEqual([
      {
        text: { en: "first point (en)", ko: "first point (ko)" },
        citations: [
          { passageId: "first", quoting: null },
          { passageId: "second", quoting: "[narrator]" },
        ],
      },
      { text: { en: "second point (en)", ko: "second point (ko)" }, citations: [] },
    ]);
    expect(explanation.parts.context).toEqual([]);
    expect(explanation.parts.relatedVerses).toEqual([
      { verse: { surah: 40, ayah: 16 }, text: { en: "why (en)", ko: null }, citations: [] },
    ]);
  });

  it("keeps the explanation's status, passages and context links in their order", () => {
    const explanation = toExplanation(row);
    expect(explanation.status).toBe("ko_drafted");
    expect(explanation.span).toEqual({
      start: { surah: 1, ayah: 2, word: 1 },
      end: { surah: 1, ayah: 2, word: 3 },
    });
    expect(explanation.passageIds).toEqual(["first", "second"]);
    expect(explanation.contextLinks.map((link) => link.reason.en)).toEqual(["a", "b"]);
  });
});

describe("toVerse", () => {
  it("orders the words by position", () => {
    const verse = toVerse(
      {
        surah: 1,
        ayah: 1,
        text_ar: "ابت ثجح",
        word: [
          { position: 2, text_ar: "ثجح", root: null },
          { position: 1, text_ar: "ابت", root: null },
        ],
        verse_transliteration: [],
      },
      "published",
    );
    expect(verse.words.map((w) => w.position)).toEqual([1, 2]);
    expect(verse.transliteration).toEqual({ en: null, ko: null });
    expect(verse.transliterationStatus).toEqual({ en: null, ko: null });
  });

  const withDraft = {
    surah: 1,
    ayah: 1,
    text_ar: "ابت",
    word: [{ position: 1, text_ar: "ابت", root: null }],
    verse_transliteration: [
      { language: "ko" as const, text: "[ko]", status: "published" as const },
      { language: "en" as const, text: "[en draft]", status: "draft" as const },
    ],
  };

  it("keeps only published transliterations on the published path", () => {
    const verse = toVerse(withDraft, "published");
    expect(verse.transliteration).toEqual({ en: null, ko: "[ko]" });
    expect(verse.transliterationStatus).toEqual({ en: null, ko: "published" });
  });

  it("keeps a tester's draft transliteration on the preview path, with its status", () => {
    const verse = toVerse(withDraft, "preview");
    expect(verse.transliteration).toEqual({ en: "[en draft]", ko: "[ko]" });
    expect(verse.transliterationStatus).toEqual({ en: "draft", ko: "published" });
  });
});

describe("toWordMeaning", () => {
  it("keeps the citations with who they quote, and the elsewhere notes in order", () => {
    const meaning = toWordMeaning({
      surah: 2,
      ayah: 3,
      position: 4,
      meaning_en: "[en]",
      meaning_ko: "[ko]",
      status: "en_approved",
      word_meaning_citation: [{ passage_id: "p", sort_order: 0, quoting: "[narrator]" }],
      word_meaning_elsewhere: [
        { sort_order: 1, verse_surah: null, verse_ayah: null, text_en: "[usage]", text_ko: null },
        { sort_order: 0, verse_surah: 109, verse_ayah: 6, text_en: "[109:6]", text_ko: "[ko]" },
      ],
    });
    expect(meaning).toEqual({
      word: { surah: 2, ayah: 3, word: 4 },
      status: "en_approved",
      meaning: { en: "[en]", ko: "[ko]" },
      citations: [{ passageId: "p", quoting: "[narrator]" }],
      elsewhere: [
        { verse: { surah: 109, ayah: 6 }, text: { en: "[109:6]", ko: "[ko]" } },
        { verse: null, text: { en: "[usage]", ko: null } },
      ],
    });
  });
});

describe("toBrief", () => {
  it("keeps the status and orders the paragraphs and their citations", () => {
    expect(
      toBrief({
        status: "ko_drafted",
        surah_brief_item: [
          { sort_order: 1, text_en: "b", text_ko: null, surah_brief_item_citation: [] },
          {
            sort_order: 0,
            text_en: "a",
            text_ko: "가",
            surah_brief_item_citation: [{ sort_order: 0, passage_id: "p", quoting: null }],
          },
        ],
      }),
    ).toEqual({
      status: "ko_drafted",
      items: [
        { text: { en: "a", ko: "가" }, citations: [{ passageId: "p", quoting: null }] },
        { text: { en: "b", ko: null }, citations: [] },
      ],
    });
  });
});

describe("toPassage", () => {
  it("gives a verse location only when both parts are present", () => {
    const base = {
      id: "p",
      volume: null,
      page: "12",
      text_ar: null,
      summary_en: null,
      summary_ko: null,
      source: {
        id: "s",
        title_ar: null,
        title_en: "T",
        author: "A",
        edition: null,
        type: "tafsir" as const,
      },
    };
    expect(toPassage({ ...base, verse_surah: null, verse_ayah: null }).verse).toBeNull();
    expect(toPassage({ ...base, verse_surah: 2, verse_ayah: 1 }).verse).toEqual({
      surah: 2,
      ayah: 1,
    });
  });
});
