import { describe, expect, it } from "vitest";
import {
  spanKeys,
  toExplanation,
  toPassage,
  toVerse,
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
    word_meanings_en: null,
    word_meanings_ko: null,
    background_en: "background (en)",
    background_ko: "background (ko)",
    context_en: null,
    context_ko: null,
    connected_verses_en: null,
    connected_verses_ko: null,
    span: span("1:2:1-1:2:3", [1, 2, 1], [1, 2, 3]),
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

  it("maps the parts and keeps citations and context links in their order", () => {
    const explanation = toExplanation(row);
    expect(explanation.parts.background).toEqual({ en: "background (en)", ko: "background (ko)" });
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
    const verse = toVerse({
      surah: 1,
      ayah: 1,
      text_ar: "ابت ثجح",
      word: [
        { position: 2, text_ar: "ثجح", root: null },
        { position: 1, text_ar: "ابت", root: null },
      ],
    });
    expect(verse.words.map((w) => w.position)).toEqual([1, 2]);
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
