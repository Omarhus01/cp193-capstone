import type { Span, TextRef } from "@/lib/domain/content";

// "2:60" is a verse, "2:60:3" the third word of it. No leading zeros, so each ref has one spelling.
const REF = /^([1-9]\d{0,2}):([1-9]\d{0,2})(?::([1-9]\d{0,2}))?$/;

export const REF_PATTERN = REF.source;

export function parseRef(ref: string): TextRef | null {
  const match = REF.exec(ref);
  if (!match) {
    return null;
  }
  return {
    surah: Number(match[1]),
    ayah: Number(match[2]),
    word: match[3] === undefined ? null : Number(match[3]),
  };
}

export function formatRef({ surah, ayah, word }: TextRef): string {
  return word === null ? `${surah}:${ayah}` : `${surah}:${ayah}:${word}`;
}

/** A span as written in content files. */
export type SpanRefs = { from: string; to: string };

export function parseSpan({ from, to }: SpanRefs): Span | null {
  const start = parseRef(from);
  const end = parseRef(to);
  return start && end ? { start, end } : null;
}

/** The canonical id of a span, which is also its primary key in the database ("1:2:1-1:2:3"). */
export function spanId({ start, end }: Span): string {
  return `${formatRef(start)}-${formatRef(end)}`;
}

/**
 * Orders two points of the text. A null word at the start of a span is before the verse's first
 * word, and at the end of a span, after its last word.
 */
function position(ref: TextRef, side: "start" | "end"): [number, number, number] {
  const word = ref.word ?? (side === "start" ? 0 : Number.POSITIVE_INFINITY);
  return [ref.surah, ref.ayah, word];
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** Whether the span ends before it starts. */
export function isReversed({ start, end }: Span): boolean {
  return compare(position(start, "start"), position(end, "end")) > 0;
}
