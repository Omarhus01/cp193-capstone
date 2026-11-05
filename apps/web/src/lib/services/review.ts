import type { ReviewStatus } from "@/lib/domain/content";

/** The review steps in order (content/README.md). */
export const REVIEW_STEPS = [
  "draft",
  "en_approved",
  "ko_drafted",
  "ko_approved",
  "published",
] as const satisfies readonly ReviewStatus[];

/**
 * The steps each kind of item goes through. Explanations, word meanings and briefs are bilingual:
 * the Korean is drafted from the approved English. A verse transliteration is written in one
 * language, so it is approved by that language's reviewer and published (ADR 0013).
 */
export const REVIEW_TRACKS = {
  bilingual: REVIEW_STEPS,
  /** Latin transliteration, for English pages. */
  latin: ["draft", "en_approved", "published"],
  /** Hangul transliteration, for Korean pages. */
  hangul: ["draft", "ko_approved", "published"],
} as const satisfies Record<string, readonly ReviewStatus[]>;

export type ReviewTrack = keyof typeof REVIEW_TRACKS;

/** One step in an item's review history, as recorded in its content file. */
export type ReviewEntry = {
  status: ReviewStatus;
  reviewer: string;
  /** YYYY-MM-DD */
  date: string;
  notes?: string;
};

/**
 * Why an item can't move from `from` to `to`, or null when it can. An item moves forward one
 * step of its track at a time. It can be sent back to any earlier step, with notes saying why.
 */
export function checkTransition(
  from: ReviewStatus,
  to: ReviewStatus,
  notes?: string,
  track: ReviewTrack = "bilingual",
): string | null {
  const steps: readonly ReviewStatus[] = REVIEW_TRACKS[track];
  for (const status of [from, to]) {
    if (!steps.includes(status)) {
      return `${status} isn't a step here; the steps are ${steps.join(" → ")}`;
    }
  }
  const fromIndex = steps.indexOf(from);
  const toIndex = steps.indexOf(to);
  if (toIndex === fromIndex + 1) {
    return null;
  }
  if (toIndex === fromIndex) {
    return `the item is already ${from}`;
  }
  if (toIndex > fromIndex) {
    return `can't skip from ${from} to ${to}: the next step is ${steps[fromIndex + 1]}`;
  }
  return notes?.trim() ? null : `sending an item back from ${from} to ${to} needs notes saying why`;
}

export type ReplayResult =
  { ok: true; status: ReviewStatus } | { ok: false; step: number; message: string };

/**
 * Replays a review history from draft. Returns the status it ends at, or the first step (0-based)
 * that breaks a rule: an illegal move or a date earlier than the step before.
 */
export function replayReview(
  history: readonly ReviewEntry[],
  track: ReviewTrack = "bilingual",
): ReplayResult {
  let status: ReviewStatus = "draft";
  let previousDate = "";
  for (const [step, entry] of history.entries()) {
    const problem = checkTransition(status, entry.status, entry.notes, track);
    if (problem) {
      return { ok: false, step, message: problem };
    }
    if (entry.date < previousDate) {
      return { ok: false, step, message: `${entry.date} is earlier than the step before it` };
    }
    status = entry.status;
    previousDate = entry.date;
  }
  return { ok: true, status };
}

/** Only published items reach readers. */
export function isVisibleToReaders(status: ReviewStatus): boolean {
  return status === "published";
}
