import { describe, expect, it } from "vitest";
import { loadContent } from "./load";
import { toSeedPlan, type SeedPlan, type SurahContentPayload } from "./payload";
import { explanation, testBundle, withPartialSurah } from "./test-bundle";

type ContentTable = Exclude<keyof SurahContentPayload, "surah">;

/** One table's rows across every surah of the plan. */
function rows(plan: SeedPlan, table: ContentTable) {
  return plan.surahs.flatMap(({ content }) => content[table]);
}

function surah(plan: SeedPlan, number: number) {
  const found = plan.surahs.find((s) => s.number === number);
  if (!found) {
    throw new Error(`no surah ${number} in the plan`);
  }
  return found;
}

describe("toSeedPlan", () => {
  it("keeps a partial surah's full verse count and seeds only the verses it holds", () => {
    const { text, content } = surah(toSeedPlan(withPartialSurah()), 4);
    expect(text.surah).toMatchObject({ number: 4, verse_count: 176 });
    expect(text.verses.map((v) => v.ayah)).toEqual([34, 35, 40]);
    expect([...new Set(text.words.map((w) => w.ayah))]).toEqual([34, 35, 40]);
    expect(content.reading_sections).toEqual([
      { surah: 4, position: 1, explanation_id: "s4-reading-1", span_id: "4:34-4:35" },
      { surah: 4, position: 2, explanation_id: "s4-reading-2", span_id: "4:40-4:40" },
    ]);
  });

  it("gives each verse its mushaf page from the metadata", () => {
    // testPages: page 1 starts at 1:1, page 2 at 1:3, page 3 at 2:1, and so on.
    const plan = toSeedPlan(withPartialSurah());
    expect(surah(plan, 1).text.verses.map((v) => [v.ayah, v.page])).toEqual([
      [1, 1],
      [2, 1],
      [3, 2],
      [4, 2],
    ]);
    expect(surah(plan, 4).text.verses.find((v) => v.ayah === 34)?.page).toBe(5);
  });

  it("orders the surahs by number and gives the same plan whatever the file order", () => {
    const reordered = testBundle();
    reordered.surahs.reverse();
    reordered.surahs[1].explanations.reverse();
    reordered.sources[0].passages.reverse();
    const plan = toSeedPlan(reordered);
    expect(plan.surahs.map((s) => s.number)).toEqual([1, 2]);
    expect(plan).toEqual(toSeedPlan(testBundle()));
  });

  it("puts every row in the request of the surah it belongs to", () => {
    const plan = toSeedPlan(withPartialSurah());
    for (const { number, text, content } of plan.surahs) {
      expect(content.surah).toBe(number);
      expect(text.surah.number).toBe(number);
      for (const row of [...text.verses, ...text.words]) {
        expect(row.surah).toBe(number);
      }
      const withSurah: ContentTable[] = [
        "reading_sections",
        "surah_briefs",
        "surah_brief_items",
        "surah_brief_item_citations",
        "surah_brief_reviews",
        "word_meanings",
        "word_meaning_citations",
        "word_meaning_elsewhere",
        "word_meaning_reviews",
        "verse_transliterations",
        "verse_transliteration_reviews",
      ];
      for (const table of withSurah) {
        for (const row of content[table]) {
          expect(row.surah, table).toBe(number);
        }
      }
      // An explanation or a question belongs to the surah its span starts in.
      const spans = new Map(content.spans.map((s) => [s.id, s]));
      for (const row of [...content.explanations, ...content.qa_questions]) {
        expect(spans.get(String(row.span_id))?.start_surah).toBe(number);
      }
      // Children point to an explanation or a question of the same request.
      const explanations = new Set(content.explanations.map((e) => e.id));
      for (const table of [
        "explanation_items",
        "explanation_item_citations",
        "explanation_citations",
        "context_links",
        "explanation_reviews",
      ] as const) {
        for (const row of content[table]) {
          expect(explanations.has(row.explanation_id), table).toBe(true);
        }
      }
      const questions = new Set(content.qa_questions.map((q) => q.id));
      for (const row of [...content.qa_question_citations, ...content.qa_question_reviews]) {
        expect(questions.has(row.question_id)).toBe(true);
      }
    }
  });

  it("lists the surah's verses and words by key, so the database can delete the rest", () => {
    const { content } = surah(toSeedPlan(withPartialSurah()), 4);
    expect(content.verses).toEqual([{ ayah: 34 }, { ayah: 35 }, { ayah: 40 }]);
    expect(content.words[0]).toEqual({ ayah: 34, position: 1 });
  });

  it("stores a span with each surah that uses it, under its canonical id", () => {
    const bundle = testBundle();
    bundle.surahs[0].explanations[2].contextLinks.push({
      span: { from: "1:1", to: "1:2" },
      reason: { en: "again", ko: "다시" },
    });
    bundle.surahs[1].explanations = [explanation("s2-note", "verse_explanation", "2:1", "2:2")];
    const plan = toSeedPlan(bundle);
    const first = surah(plan, 1).content;
    expect(first.spans.filter((s) => s.id === "1:1-1:2")).toHaveLength(1);
    expect(first.context_links.map((l) => l.span_id)).toEqual(["2:1-2:2", "1:1-1:2"]);
    // 2:1–2 is a surah 2 explanation and the target of surah 1's context link, so both send it.
    expect(surah(plan, 2).content.spans.map((s) => s.id)).toContain("2:1-2:2");
    expect(first.spans.map((s) => s.id)).toContain("2:1-2:2");
    expect(first.spans.find((s) => s.id === "1:2:2-1:2:3")).toEqual({
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
    const plan = toSeedPlan(testBundle());
    expect(surah(plan, 1).content.reading_sections).toEqual([
      { surah: 1, position: 1, explanation_id: "s1-reading-1", span_id: "1:1-1:2" },
      { surah: 1, position: 2, explanation_id: "s1-reading-2", span_id: "1:3-1:4" },
    ]);
    expect(
      rows(plan, "explanation_reviews")
        .filter((r) => r.explanation_id === "s1-note")
        .map((r) => r.step),
    ).toEqual([0, 1, 2, 3]);
  });

  it("stores transliterations per verse and language, with their review steps", () => {
    const plan = toSeedPlan(testBundle());
    expect(rows(plan, "verse_transliterations")).toEqual([
      { surah: 1, ayah: 1, language: "en", text: "pronunciation of 1:1 (en)", status: "published" },
      { surah: 1, ayah: 1, language: "ko", text: "pronunciation of 1:1 (ko)", status: "published" },
      { surah: 1, ayah: 2, language: "en", text: null, status: "draft" },
    ]);
    expect(
      rows(plan, "verse_transliteration_reviews")
        .filter((r) => r.language === "ko")
        .map((r) => [r.step, r.status]),
    ).toEqual([
      [0, "ko_approved"],
      [1, "published"],
    ]);
  });

  it("stores each point of an explanation with its own citations", () => {
    const plan = toSeedPlan(testBundle());
    const items = rows(plan, "explanation_items").filter(
      (i) => i.explanation_id === "s1-reading-1",
    );
    expect(items.map((i) => [i.part, i.sort_order, i.verse_surah, i.verse_ayah])).toEqual([
      ["background", 0, null, null],
      ["connected_verses", 0, 3, 5],
      ["context", 0, null, null],
    ]);
    expect(
      rows(plan, "explanation_item_citations")
        .filter((c) => c.explanation_id === "s1-reading-1" && c.part === "context")
        .map((c) => [c.sort_order, c.passage_id, c.quoting]),
    ).toEqual([
      [0, "passage-1", null],
      [1, "passage-2", "[narrator]"],
    ]);
    // The explanation's passages, each once, in the order its parts first cite them.
    expect(
      rows(plan, "explanation_citations")
        .filter((c) => c.explanation_id === "s1-reading-1")
        .map((c) => c.passage_id),
    ).toEqual(["passage-1", "passage-2"]);
  });

  it("stores the brief's paragraphs and a word meaning's elsewhere notes", () => {
    const plan = toSeedPlan(testBundle());
    expect(rows(plan, "surah_briefs")).toEqual([{ surah: 1, status: "published" }]);
    expect(rows(plan, "surah_brief_items").map((i) => i.text_en)).toEqual([
      "brief paragraph 1 (en)",
      "brief paragraph 2 (en)",
    ]);
    expect(
      rows(plan, "surah_brief_item_citations").map((c) => [c.item_order, c.passage_id]),
    ).toEqual([
      [0, "passage-1"],
      [1, "passage-2"],
    ]);
    expect(rows(plan, "word_meaning_elsewhere")).toEqual([
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
    const explanations = rows(toSeedPlan(testBundle()), "explanations");
    expect(explanations.find((e) => e.id === "s1-draft")?.status).toBe("draft");
  });

  it("sends the sources and passages once, shared by every surah", () => {
    const { shared, finish } = toSeedPlan(testBundle());
    expect(shared.passages.find((p) => p.id === "passage-2")).toMatchObject({
      page: null,
      verse_surah: 2,
      verse_ayah: 1,
      url: null,
    });
    expect(shared.passages.find((p) => p.id === "passage-1")).toMatchObject({
      url: "https://example.com/book/1/10",
    });
    expect(finish.sources).toEqual(shared.sources.map((s) => s.id));
    expect(finish.passages).toEqual(shared.passages.map((p) => p.id));
  });

  it("stores fixed questions with their spans, citations and review steps", () => {
    const plan = toSeedPlan(testBundle());
    expect(rows(plan, "qa_questions")).toEqual([
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
      rows(plan, "qa_question_citations")
        .filter((c) => c.question_id === "s1-qa-2")
        .map((c) => [c.sort_order, c.passage_id, c.quoting]),
    ).toEqual([
      [0, "passage-2", null],
      [1, "passage-1", "[narrator]"],
    ]);
    expect(rows(plan, "spans").map((s) => s.id)).toContain("1:4-1:4");
    expect(
      rows(plan, "qa_question_reviews")
        .filter((r) => r.question_id === "s1-qa-1")
        .map((r) => r.status),
    ).toEqual(["en_approved", "ko_drafted", "ko_approved", "published"]);
  });

  it("on a full seed, lists every surah for the finish step to keep", () => {
    expect(toSeedPlan(withPartialSurah()).finish.surahs).toEqual([1, 2, 4]);
  });

  it("seeds only the surahs asked for, with the shared data, and keeps the others", () => {
    const full = toSeedPlan(withPartialSurah());
    const some = toSeedPlan(withPartialSurah(), [4, 1]);
    expect(some.surahs.map((s) => s.number)).toEqual([1, 4]);
    expect(some.surahs).toEqual([surah(full, 1), surah(full, 4)]);
    expect(some.shared).toEqual(full.shared);
    expect(some.finish).toEqual({ ...full.finish, surahs: null });
  });

  it("keeps every request of the real content small (the whole Quran was 6.5 MB in one)", () => {
    const { bundle } = loadContent();
    const plan = toSeedPlan(bundle);
    const sizes = [
      JSON.stringify(plan.shared).length,
      JSON.stringify(plan.finish).length,
      ...plan.surahs.flatMap(({ text, content }) => [
        JSON.stringify(text).length,
        JSON.stringify(content).length,
      ]),
    ];
    expect(plan.surahs).toHaveLength(114);
    expect(Math.max(...sizes)).toBeLessThan(1_000_000);
  });
});
