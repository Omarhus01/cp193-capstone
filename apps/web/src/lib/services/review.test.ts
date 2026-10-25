import { describe, expect, it } from "vitest";
import type { ReviewStatus } from "@/lib/domain/content";
import {
  REVIEW_STEPS,
  REVIEW_TRACKS,
  canTransition,
  isVisibleToReaders,
  recordReview,
  replayReview,
  type ReviewEntry,
} from "./review";

const entry = (status: ReviewStatus, date = "2026-10-24", notes?: string): ReviewEntry => ({
  status,
  reviewer: "Reviewer",
  date,
  notes,
});

describe("canTransition", () => {
  it("moves forward one step at a time", () => {
    for (let i = 0; i < REVIEW_STEPS.length - 1; i++) {
      expect(canTransition(REVIEW_STEPS[i], REVIEW_STEPS[i + 1])).toBe(true);
    }
  });

  it("never skips a step", () => {
    for (let i = 0; i < REVIEW_STEPS.length; i++) {
      for (let j = i + 2; j < REVIEW_STEPS.length; j++) {
        expect(canTransition(REVIEW_STEPS[i], REVIEW_STEPS[j], "notes")).toBe(false);
      }
    }
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("en_approved", "ko_approved")).toBe(false);
  });

  it("doesn't move to the step the item is already at", () => {
    expect(canTransition("draft", "draft", "notes")).toBe(false);
  });

  it("sends an item back to any earlier step, only with notes", () => {
    expect(canTransition("published", "draft", "Arabic source re-checked")).toBe(true);
    expect(canTransition("ko_approved", "ko_drafted", "wording")).toBe(true);
    expect(canTransition("ko_approved", "ko_drafted")).toBe(false);
    expect(canTransition("ko_approved", "ko_drafted", "  ")).toBe(false);
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

describe("recordReview", () => {
  const draft = { id: "item", status: "draft" as ReviewStatus, review: [] as ReviewEntry[] };

  it("adds the step and moves the status", () => {
    const next = recordReview(draft, entry("en_approved"));
    expect(next).toEqual({ id: "item", status: "en_approved", review: [entry("en_approved")] });
  });

  it("throws on a skipped step and leaves the item as it was", () => {
    expect(() => recordReview(draft, entry("published"))).toThrow(/skip/);
    expect(draft.review).toEqual([]);
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
      expect(canTransition("draft", "published", undefined, track)).toBe(false);
    }
  });

  it("rejects the steps of the other language and of the bilingual track", () => {
    expect(canTransition("draft", "ko_approved", undefined, "latin")).toBe(false);
    expect(canTransition("draft", "en_approved", undefined, "hangul")).toBe(false);
    const result = replayReview([entry("en_approved"), entry("ko_drafted")], "latin");
    expect(result).toMatchObject({ ok: false, step: 1 });
  });

  it("sends a transliteration back only with notes", () => {
    expect(canTransition("published", "draft", undefined, "hangul")).toBe(false);
    expect(canTransition("published", "draft", "Wrong vowel", "hangul")).toBe(true);
  });

  it("keeps the bilingual track as the default", () => {
    expect(REVIEW_TRACKS.bilingual).toEqual(REVIEW_STEPS);
    expect(() =>
      recordReview({ status: "draft" as ReviewStatus, review: [] }, entry("ko_approved"), "hangul"),
    ).not.toThrow();
    expect(() =>
      recordReview({ status: "draft" as ReviewStatus, review: [] }, entry("ko_approved")),
    ).toThrow(/skip/);
  });
});

describe("isVisibleToReaders", () => {
  it("shows only published items", () => {
    expect(REVIEW_STEPS.filter(isVisibleToReaders)).toEqual(["published"]);
  });
});
