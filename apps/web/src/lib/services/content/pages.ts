import type { VerseRef } from "@/lib/domain/content";

// Pages of the Madani mushaf, as Tanzil's metadata marks them: the first verse of each page
// (quran-metadata.json, "pages"). The seed gives every verse its page, and the surah page groups
// verses that have no explanation yet by page.

type PageStartRef = VerseRef & { page: number };

/**
 * A function that gives the page a verse is on: the last page that starts at or before it. Null
 * before the first page start (only when the list is empty or doesn't start at 1:1).
 */
export function pageLookup(pages: readonly PageStartRef[]): (verse: VerseRef) => number | null {
  const sorted = [...pages].sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
  return ({ surah, ayah }) => {
    // Binary search for the last start that isn't after the verse.
    let [low, high, found] = [0, sorted.length - 1, -1];
    while (low <= high) {
      const middle = (low + high) >> 1;
      const start = sorted[middle];
      if (start.surah < surah || (start.surah === surah && start.ayah <= ayah)) {
        found = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found === -1 ? null : sorted[found].page;
  };
}
