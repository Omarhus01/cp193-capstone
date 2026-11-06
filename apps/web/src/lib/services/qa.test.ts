import { describe, expect, it } from "vitest";
import type { FixedQuestion, Passage } from "@/lib/domain/content";
import { questionPassageIds, questionsBySection, questionsForSection } from "./qa";

// Placeholder text only: real questions and answers are written and validated by the owner.

const passage = (id: string): Passage => ({
  id,
  source: {
    id: "source",
    titleAr: null,
    titleEn: "[Test source]",
    author: "[Test author]",
    edition: null,
    type: "tafsir",
  },
  volume: "1",
  page: "10",
  verse: null,
  textAr: null,
  summary: { en: null, ko: null },
  url: null,
});

const verse = (ayah: number) => ({ surah: 1, ayah });

/** Section 1 holds verses 1:1–2, section 2 holds 1:3. */
const SECTIONS = [
  { position: 1, verses: [verse(1), verse(2)] },
  { position: 2, verses: [verse(3)] },
];

function question(
  id: string,
  from: number,
  to: number,
  passageIds: string[] = ["p1"],
): FixedQuestion {
  return {
    id,
    span: {
      start: { surah: 1, ayah: from, word: null },
      end: { surah: 1, ayah: to, word: null },
    },
    question: { en: `[question ${id} en]`, ko: `[question ${id} ko]` },
    answer: { en: `[answer ${id} en]`, ko: `[answer ${id} ko]` },
    citations: passageIds.map((passageId) => ({ passageId, quoting: null })),
  };
}

const passages = new Map([passage("p1"), passage("p2")].map((p) => [p.id, p]));

describe("questionsBySection", () => {
  it("lists each question under the section holding its first verse, in order", () => {
    const bySection = questionsBySection(
      SECTIONS,
      [question("a", 2, 2), question("b", 3, 3), question("c", 1, 2)],
      passages,
    );
    expect(questionsForSection(bySection, 1).map((q) => q.id)).toEqual(["a", "c"]);
    expect(questionsForSection(bySection, 2).map((q) => q.id)).toEqual(["b"]);
    expect(questionsForSection(bySection, 3)).toEqual([]);
  });

  it("numbers sources within each answer, lists them in number order, and keeps who a source quotes", () => {
    const quoting: FixedQuestion = {
      ...question("a", 1, 1),
      citations: [
        { passageId: "p2", quoting: null },
        { passageId: "p1", quoting: "[narrator]" },
        { passageId: "p2", quoting: null },
      ],
    };
    const [view] = questionsForSection(
      questionsBySection(SECTIONS, [quoting, question("b", 1, 1, ["p1"])], passages),
      1,
    );
    expect(view.sources.map((s) => [s.number, s.passage.id, s.quoting])).toEqual([
      [1, "p2", null],
      [1, "p2", null],
      [2, "p1", "[narrator]"],
    ]);
    expect(view).toMatchObject({
      question: { en: "[question a en]", ko: "[question a ko]" },
      answer: { en: "[answer a en]", ko: "[answer a ko]" },
    });
  });

  it("leaves out a question whose sources readers can't see", () => {
    const bySection = questionsBySection(
      SECTIONS,
      [question("hidden", 1, 1, ["p9"]), question("partly", 1, 1, ["p9", "p1"])],
      passages,
    );
    const views = questionsForSection(bySection, 1);
    expect(views.map((q) => q.id)).toEqual(["partly"]);
    expect(views[0].sources.map((s) => s.passage.id)).toEqual(["p1"]);
  });

  it("leaves out a question with nothing written, or outside every section", () => {
    const empty = { ...question("empty", 1, 1), answer: { en: null, ko: null } };
    expect(questionsBySection(SECTIONS, [empty, question("outside", 7, 7)], passages)).toEqual({});
  });
});

describe("questionPassageIds", () => {
  it("lists each cited passage once", () => {
    expect(
      questionPassageIds([question("a", 1, 1, ["p1", "p2"]), question("b", 1, 1, ["p2"])]),
    ).toEqual(["p1", "p2"]);
  });
});
