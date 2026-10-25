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
    });
  });
});
