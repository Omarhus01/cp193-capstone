/** A verse reference, "<surah>:<verse>" (e.g. "2:60"). */
export type VerseKey = string;

/**
 * A question about a verse. Fixed questions, written and validated by the content owner, have
 * an id; questions the user types do not.
 */
export type Question = { verseKey: VerseKey; text: string; fixedQuestionId?: string };

/** Where a claim comes from: a source page inside the platform and the place in that source. */
export type Citation = {
  sourceId: string;
  title: string;
  /** Page, volume or hadith number, as the source numbers it. */
  locator: string;
};

export type Answer = { text: string; citations: Citation[] };

/** An owner-validated answer to a fixed question. */
export type PreparedAnswer = { fixedQuestionId: string; answer: Answer };

/**
 * The outcome of a question. The platform declines rather than answer without a source
 * (proposal, #ethicalconsiderations).
 */
export type QaResult =
  { kind: "answered"; answer: Answer } | { kind: "declined"; reason: "noSupportingSources" };
