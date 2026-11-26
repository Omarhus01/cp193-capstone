// Matching headings that quote a verse without its number, against the surah's text from Tanzil.
import { consonantSkeleton } from "./arabic";
import type { SurahVerses } from "./types";

// Shorter quotes fit many verses by chance.
const MIN_LETTERS = 8;
// A shorter verse counts inside a longer quote only at its start or end.
const MIN_LETTERS_AT_EDGE = 4;

function quoteSkeleton(quote: string): string {
  return consonantSkeleton(quote.replace(/[\s﴾).،,؛]+الآية[\s.]*$/, ""));
}

/** A heading's quote, cut where it prints the number of a verse: "… (٢٩) …" is two parts. */
export function quoteParts(quote: string): string[] {
  return quote.split(/\(\d+\)/).filter((part) => quoteSkeleton(part) !== "");
}

/** Whether a quote is long enough to say which verse it is from. */
export function isLongQuote(quote: string): boolean {
  return quoteSkeleton(quote).length >= MIN_LETTERS;
}

/** The verses (from 1) a quote can be from: it is part of the verse, or it holds all of it. */
export function versesOfQuote(quote: string, verses: SurahVerses): number[] {
  const quoted = quoteSkeleton(quote);
  if (quoted === "") return [];
  return verses.flatMap((text, i) => {
    const verse = consonantSkeleton(text);
    const fits =
      verse === quoted ||
      (quoted.length >= MIN_LETTERS && verse.includes(quoted)) ||
      (verse.length >= MIN_LETTERS && quoted.includes(verse)) ||
      (verse.length >= MIN_LETTERS_AT_EDGE && (quoted.startsWith(verse) || quoted.endsWith(verse)));
    return fits ? [i + 1] : [];
  });
}

/** Whether a quote, however short, is in this verse. */
export function isPartOfVerse(quote: string, verse: string): boolean {
  const quoted = quoteSkeleton(quote);
  return quoted !== "" && consonantSkeleton(verse).includes(quoted);
}
