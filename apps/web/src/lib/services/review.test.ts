import { describe, expect, it } from "vitest";
import type { ReviewStatus } from "@/lib/domain/content";
import {
  REVIEW_STEPS,
  REVIEW_TRACKS,
  checkTransition,
  isVisibleToReaders,
  replayReview,
  type ReviewEntry,
} from "./review";

const entry = (status: ReviewStatus, date = "2026-10-24", notes?: string): ReviewEntry => ({
  status,
  reviewer: "Reviewer",
  date,
  notes,
});

/** Whether a move is allowed: checkTransition gives no reason against it. */
const allows = (...args: Parameters<typeof checkTransition>) => checkTransition(...args) === null;

describe("checkTransition", () => {
  it("moves forward one step at a time", () => {
    for (let i = 0; i < REVIEW_STEPS.length - 1; i++) {
      expect(allows(REVIEW_STEPS[i], REVIEW_STEPS[i + 1])).toBe(true);
    }
  });

  it("never skips a step", () => {
    for (let i = 0; i < REVIEW_STEPS.length; i++) {
      for (let j = i + 2; j < REVIEW_STEPS.length; j++) {
        expect(allows(REVIEW_STEPS[i], REVIEW_STEPS[j], "notes")).toBe(false);
      }
    }
    expect(allows("draft", "published")).toBe(false);
    expect(allows("en_approved", "ko_approved")).toBe(false);
  });

  it("doesn't move to the step the item is already at", () => {
    expect(allows("draft", "draft", "notes")).toBe(false);
  });

  it("sends an item back to any earlier step, only with notes", () => {
    expect(allows("published", "draft", "Arabic source re-checked")).toBe(true);
    expect(allows("ko_approved", "ko_drafted", "wording")).toBe(true);
    expect(allows("ko_approved", "ko_drafted")).toBe(false);
    expect(allows("ko_approved", "ko_drafted", "  ")).toBe(false);
  });
});

describe("replayReview", () => {
  it("starts at draft", () => {
    expect(replayReview([])).toEqual({ ok: true, status: "draft" });
  });

  it("ends at published after every step in order", () => {
    const history = REVIEW_STEPS.slice(1).map((status) => entry(status));
    expect(replayReview(history)).toEqual({ ok: true, status: "published" });
  });

  it("reports the first step that skips ahead", () => {
    const result = replayReview([entry("en_approved"), entry("ko_approved")]);
    expect(result).toEqual({ ok: false, step: 1, message: expect.stringContaining("skip") });
  });

  it("allows going back and through the steps again", () => {
    const history = [
      entry("en_approved"),
      entry("ko_drafted"),
      entry("en_approved", "2026-10-25", "English changed"),
      entry("ko_drafted", "2026-10-26"),
    ];
    expect(replayReview(history)).toEqual({ ok: true, status: "ko_drafted" });
  });

  it("rejects a date earlier than the step before", () => {
    const result = replayReview([
      entry("en_approved", "2026-10-24"),
      entry("ko_drafted", "2026-10-01"),
    ]);
    expect(result).toMatchObject({ ok: false, step: 1 });
  });
});

describe("transliteration tracks", () => {
  it("approves a Latin transliteration in English and a Hangul one in Korean", () => {
    expect(replayReview([entry("en_approved"), entry("published")], "latin")).toEqual({
      ok: true,
      status: "published",
    });
    expect(replayReview([entry("ko_approved"), entry("published")], "hangul")).toEqual({
      ok: true,
      status: "published",
    });
  });

  it("never skips the approval", () => {
    for (const track of ["latin", "hangul"] as const) {
      expect(allows("draft", "published", undefined, track)).toBe(false);
    }
  });

  it("rejects the steps of the other language and of the bilingual track", () => {
    expect(allows("draft", "ko_approved", undefined, "latin")).toBe(false);
    expect(allows("draft", "en_approved", undefined, "hangul")).toBe(false);
    const result = replayReview([entry("en_approved"), entry("ko_drafted")], "latin");
    expect(result).toMatchObject({ ok: false, step: 1 });
  });

  it("sends a transliteration back only with notes", () => {
    expect(allows("published", "draft", undefined, "hangul")).toBe(false);
    expect(allows("published", "draft", "Wrong vowel", "hangul")).toBe(true);
  });

  it("keeps the bilingual track as the default", () => {
    expect(REVIEW_TRACKS.bilingual).toEqual(REVIEW_STEPS);
    expect(allows("draft", "ko_approved", undefined, "hangul")).toBe(true);
    expect(checkTransition("draft", "ko_approved")).toMatch(/skip/);
  });
});

describe("isVisibleToReaders", () => {
  it("shows only published items", () => {
    expect(REVIEW_STEPS.filter(isVisibleToReaders)).toEqual(["published"]);
  });
});
