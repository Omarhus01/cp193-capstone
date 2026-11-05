import { describe, expect, it } from "vitest";
import { toSeedPayload } from "./payload";
import { testBundle } from "./test-bundle";

describe("toSeedPayload", () => {
  it("gives the same payload for the same content, whatever the file order", () => {
    const reordered = testBundle();
    reordered.surahs.reverse();
    reordered.surahs[1].explanations.reverse();
    expect(toSeedPayload(reordered)).toEqual(toSeedPayload(testBundle()));
  });

  it("stores each span once, under its canonical id", () => {
    const bundle = testBundle();
    bundle.surahs[0].explanations[2].contextLinks.push({
      span: { from: "1:1", to: "1:2" },
      reason: { en: "again", ko: "다시" },
    });
    const { spans, context_links } = toSeedPayload(bundle);
    expect(spans.filter((s) => s.id === "1:1-1:2")).toHaveLength(1);
    expect(context_links.map((l) => l.span_id)).toEqual(["2:1-2:2", "1:1-1:2"]);
    expect(spans.find((s) => s.id === "1:2:2-1:2:3")).toEqual({
      id: "1:2:2-1:2:3",
      start_surah: 1,
      start_ayah: 2,
      start_word: 2,
      end_surah: 1,
      end_ayah: 2,
      end_word: 3,
    });
  });

  it("numbers reading sections and review steps in order", () => {
    const payload = toSeedPayload(testBundle());
    expect(payload.reading_sections).toEqual([
      { surah: 1, position: 1, explanation_id: "s1-reading-1", span_id: "1:1-1:2" },
      { surah: 1, position: 2, explanation_id: "s1-reading-2", span_id: "1:3-1:4" },
    ]);
    expect(
      payload.explanation_reviews.filter((r) => r.explanation_id === "s1-note").map((r) => r.step),
    ).toEqual([0, 1, 2, 3]);
  });

  it("stores transliterations per verse and language, with their review steps", () => {
    const payload = toSeedPayload(testBundle());
    expect(payload.verse_transliterations).toEqual([
      { surah: 1, ayah: 1, language: "en", text: "pronunciation of 1:1 (en)", status: "published" },
      { surah: 1, ayah: 1, language: "ko", text: "pronunciation of 1:1 (ko)", status: "published" },
      { surah: 1, ayah: 2, language: "en", text: null, status: "draft" },
    ]);
    expect(
      payload.verse_transliteration_reviews
        .filter((r) => r.language === "ko")
        .map((r) => [r.step, r.status]),
    ).toEqual([
      [0, "ko_approved"],
      [1, "published"],
    ]);
  });

  it("stores each point of an explanation with its own citations", () => {
    const payload = toSeedPayload(testBundle());
    const items = payload.explanation_items.filter((i) => i.explanation_id === "s1-reading-1");
    expect(items.map((i) => [i.part, i.sort_order, i.verse_surah, i.verse_ayah])).toEqual([
      ["background", 0, null, null],
      ["connected_verses", 0, 3, 5],
      ["context", 0, null, null],
    ]);
    expect(
      payload.explanation_item_citations
        .filter((c) => c.explanation_id === "s1-reading-1" && c.part === "context")
        .map((c) => [c.sort_order, c.passage_id, c.quoting]),
    ).toEqual([
      [0, "passage-1", null],
      [1, "passage-2", "[narrator]"],
    ]);
    // The explanation's passages, each once, in the order its parts first cite them.
    expect(
      payload.explanation_citations
        .filter((c) => c.explanation_id === "s1-reading-1")
        .map((c) => c.passage_id),
    ).toEqual(["passage-1", "passage-2"]);
  });

  it("stores the brief's paragraphs and a word meaning's elsewhere notes", () => {
    const payload = toSeedPayload(testBundle());
    expect(payload.surah_briefs).toEqual([{ surah: 1, status: "published" }]);
    expect(payload.surah_brief_items.map((i) => i.text_en)).toEqual([
      "brief paragraph 1 (en)",
      "brief paragraph 2 (en)",
    ]);
    expect(payload.surah_brief_item_citations.map((c) => [c.item_order, c.passage_id])).toEqual([
      [0, "passage-1"],
      [1, "passage-2"],
    ]);
    expect(payload.word_meaning_elsewhere).toEqual([
      {
        surah: 1,
        ayah: 1,
        position: 1,
        sort_order: 0,
        verse_surah: 2,
        verse_ayah: 3,
        text_en: "elsewhere in 2:3 (en)",
        text_ko: "elsewhere in 2:3 (ko)",
      },
    ]);
  });

  it("keeps drafts, so the database decides what readers see", () => {
    const { explanations } = toSeedPayload(testBundle());
    expect(explanations.find((e) => e.id === "s1-draft")?.status).toBe("draft");
  });

  it("locates a passage by its verse when there is no page", () => {
    const { passages } = toSeedPayload(testBundle());
    expect(passages.find((p) => p.id === "passage-2")).toMatchObject({
      page: null,
      verse_surah: 2,
      verse_ayah: 1,
      url: null,
    });
    expect(passages.find((p) => p.id === "passage-1")).toMatchObject({
      url: "https://example.com/book/1/10",
    });
  });

  it("stores fixed questions with their spans, citations and review steps", () => {
    const payload = toSeedPayload(testBundle());
    expect(payload.qa_questions).toEqual([
      {
        id: "s1-qa-1",
        span_id: "1:1-1:2",
        sort_order: 0,
        question_en: "question s1-qa-1 (en)",
        question_ko: "question s1-qa-1 (ko)",
        answer_en: "answer s1-qa-1 (en)",
        answer_ko: "answer s1-qa-1 (ko)",
        status: "published",
      },
      expect.objectContaining({ id: "s1-qa-2", span_id: "1:3-1:3", sort_order: 1 }),
      expect.objectContaining({ id: "s1-qa-draft", sort_order: 2, status: "draft" }),
    ]);
    expect(
      payload.qa_question_citations
        .filter((c) => c.question_id === "s1-qa-2")
        .map((c) => [c.sort_order, c.passage_id, c.quoting]),
    ).toEqual([
      [0, "passage-2", null],
      [1, "passage-1", "[narrator]"],
    ]);
    expect(payload.spans.map((s) => s.id)).toContain("1:4-1:4");
    expect(
      payload.qa_question_reviews.filter((r) => r.question_id === "s1-qa-1").map((r) => r.status),
    ).toEqual(["en_approved", "ko_drafted", "ko_approved", "published"]);
  });
});
