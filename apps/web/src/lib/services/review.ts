import type { ReviewStatus } from "@/lib/domain/content";

/** The review steps in order (content/README.md). */
export const REVIEW_STEPS = [
  "draft",
  "en_approved",
  "ko_drafted",
  "ko_approved",
  "published",
] as const satisfies readonly ReviewStatus[];

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
 * step at a time. It can be sent back to any earlier step, with notes saying why.
 */
export function checkTransition(
  from: ReviewStatus,
  to: ReviewStatus,
  notes?: string,
): string | null {
  const fromIndex = REVIEW_STEPS.indexOf(from);
  const toIndex = REVIEW_STEPS.indexOf(to);
  if (toIndex === fromIndex + 1) {
    return null;
  }
  if (toIndex === fromIndex) {
    return `the item is already ${from}`;
  }
  if (toIndex > fromIndex) {
    return `can't skip from ${from} to ${to}: the next step is ${REVIEW_STEPS[fromIndex + 1]}`;
  }
  return notes?.trim() ? null : `sending an item back from ${from} to ${to} needs notes saying why`;
}

export function canTransition(from: ReviewStatus, to: ReviewStatus, notes?: string): boolean {
  return checkTransition(from, to, notes) === null;
}

export type ReplayResult =
  { ok: true; status: ReviewStatus } | { ok: false; step: number; message: string };

/**
 * Replays a review history from draft. Returns the status it ends at, or the first step (0-based)
 * that breaks a rule: an illegal move or a date earlier than the step before.
 */
export function replayReview(history: readonly ReviewEntry[]): ReplayResult {
  let status: ReviewStatus = "draft";
  let previousDate = "";
  for (const [step, entry] of history.entries()) {
    const problem = checkTransition(status, entry.status, entry.notes);
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

/**
 * Adds a review step to an item. Throws when the move isn't allowed, so a step can't be skipped.
 */
export function recordReview<T extends { status: ReviewStatus; review: readonly ReviewEntry[] }>(
  item: T,
  entry: ReviewEntry,
): T {
  const problem = checkTransition(item.status, entry.status, entry.notes);
  if (problem) {
    throw new Error(problem);
  }
  return { ...item, status: entry.status, review: [...item.review, entry] };
}

/** Only published items reach readers. */
export function isVisibleToReaders(status: ReviewStatus): boolean {
  return status === "published";
}
