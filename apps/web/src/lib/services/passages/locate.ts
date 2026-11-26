// Where a book discusses a verse, decided from its table of contents alone.
import { longestRun } from "./longest-run";
import { isLongQuote, isPartOfVerse, quoteParts, versesOfQuote } from "./quotes";
import type { SurahNames } from "./surah-names";
import type { ExportBook, Location, PlannedSection, SurahVerses, VerseRef } from "./types";
import { parseVerseHeading, type VerseHeading } from "./verse-heading";

type Heading = {
  tocId: number;
  title: string;
  pageId: number;
  depth: number;
  /** Surahs this heading opens, if it is a surah heading. */
  opens: number[];
  /** A surah heading out of the Quran's order, so it probably names the wrong surah. */
  misplaced: boolean;
  /** The surahs this heading is under (two only for one that opens the last two surahs). */
  surahs: number[];
  verses: VerseHeading | null;
};

// A book whose sections are named by a single verse ("34") can cover the next verses in the same
// section. Past a surah's last such heading, only this many more verses are taken to be in it.
const MAX_VERSES_AFTER_LAST_HEADING = 10;
// A heading for all of a surah this long doesn't say where a verse is.
const LONG_SURAH = 20;

function readHeadings(book: ExportBook, names: SurahNames): Heading[] {
  const byId = new Map(book.toc.map((entry) => [entry.id, entry]));
  const read = new Map<number, Heading>();
  const titleSurah = names.ofBookTitle(book.title);
  const surahHeadings = book.toc
    .map((entry) => ({ entry, opens: names.ofHeading(entry.title, !byId.has(entry.parent)) }))
    .filter(({ opens }) => opens.length > 0);
  // Some headings in the export name the wrong surah. All the books follow the Quran's order, so a
  // heading that breaks it isn't trusted.
  const inOrder = new Map(
    longestRun(surahHeadings, (a, b) => a.opens[0] <= b.opens[0]).map(({ entry, opens }) => [
      entry.id,
      opens,
    ]),
  );
  const named = new Set(surahHeadings.map(({ entry }) => entry.id));
  let lastOpened: number[] = [];
  return book.toc.map((entry) => {
    let depth = 0;
    for (let up = byId.get(entry.parent); up && depth < 20; up = byId.get(up.parent)) depth++;
    const opens = inOrder.get(entry.id) ?? [];
    const misplaced = named.has(entry.id) && opens.length === 0;
    if (named.has(entry.id)) lastOpened = opens;
    const verses = named.has(entry.id) ? null : parseVerseHeading(entry.title);
    let surahs = opens;
    if (verses?.style === "surah-range") {
      surahs = [verses.surah];
    } else if (surahs.length === 0 && !misplaced) {
      const parent = read.get(entry.parent);
      surahs = parent?.surahs.length ? parent.surahs : lastOpened;
      if (named.size === 0 && titleSurah !== null) surahs = [titleSurah];
    }
    const heading = {
      tocId: entry.id,
      title: entry.title,
      pageId: entry.page_id,
      depth,
      opens,
      misplaced,
      surahs,
      verses,
    };
    read.set(entry.id, heading);
    return heading;
  });
}

/** Whether `heading` ends the section of the verse heading `start`. */
function endsSection(heading: Heading, start: Heading, styles: ReadonlySet<string>): boolean {
  if (heading.misplaced) return true;
  if (heading.opens.length > 0) return !heading.opens.some((surah) => start.surahs.includes(surah));
  if (heading.verses && styles.has(heading.verses.style)) return true;
  // Subheadings ("lessons from this verse") belong to the section, an appendix doesn't.
  return heading.depth < start.depth;
}

/** The sections of the chosen headings. Consecutive chosen headings make one section. */
function sectionsOf(
  headings: readonly Heading[],
  isChosen: (heading: Heading) => boolean,
  styles: ReadonlySet<string>,
): PlannedSection[] {
  const sections: PlannedSection[] = [];
  let open: { start: Heading; section: PlannedSection } | null = null;
  for (const heading of headings) {
    if (isChosen(heading)) {
      if (open) {
        open.section.headings.push(heading.title);
      } else {
        const section: PlannedSection = {
          from: heading.pageId,
          endsAt: null,
          headings: [heading.title],
        };
        sections.push(section);
        open = { start: heading, section };
      }
    } else if (open && endsSection(heading, open.start, styles)) {
      open.section.endsAt = { tocId: heading.tocId, pageId: heading.pageId };
      open = null;
    }
  }
  return sections;
}

/** The surah's first page, and the first page of the next surah, by the table of contents. */
function surahPages(headings: readonly Heading[], surah: number) {
  const start = headings.findIndex(
    (heading) => heading.opens.includes(surah) || heading.surahs.includes(surah),
  );
  if (start === -1) return null;
  const end = headings
    .slice(start + 1)
    .find(
      (heading) =>
        heading.misplaced || (heading.opens.length > 0 && !heading.opens.includes(surah)),
    );
  return { from: headings[start].pageId, to: end?.pageId ?? null };
}

/** A misplaced heading next to where the surah should be: the surah could be under it. */
function misplacedNear(headings: readonly Heading[], surah: number): Heading | undefined {
  return headings.find((heading, i) => {
    if (!heading.misplaced) return false;
    const before = headings.slice(0, i).findLast(({ opens }) => opens.length > 0);
    const after = headings.slice(i).find(({ opens }) => opens.length > 0);
    return surah >= (before?.opens[0] ?? 1) && surah <= (after?.opens[0] ?? 114);
  });
}

/** Why there is nothing for the verse, and the page to start looking at by hand. */
function missing(
  headings: readonly Heading[],
  surah: number,
  reason: string,
  surahPage: number | null,
): Location {
  const suspect = misplacedNear(headings, surah);
  if (!suspect) return { kind: "missing", reason, surahPage };
  return {
    kind: "missing",
    reason: `${reason}, but its heading "${suspect.title}" is out of order and may be this surah`,
    surahPage: suspect.pageId,
  };
}

const covers = (verses: VerseHeading | null, ayah: number): boolean =>
  verses !== null &&
  verses.from !== null &&
  verses.to !== null &&
  verses.from <= ayah &&
  ayah <= verses.to;

function locateByQuote(
  headings: readonly Heading[],
  quoted: readonly Heading[],
  verse: VerseRef,
  verses: SurahVerses | null,
  surahPage: number,
): Location {
  const chosen = new Set<Heading>();
  const otherVerses = new Set<number>();
  let certain = true;
  let afterChosen: boolean = false;
  for (const heading of quoted) {
    if (heading.verses?.style !== "quote") continue;
    const parts = quoteParts(heading.verses.quote);
    const hasNumber = covers(heading.verses, verse.ayah);
    let matches = hasNumber;
    if (verses) {
      // The words decide. A printed number alone can be a misprint, or of another surah.
      const text = verses[verse.ayah - 1];
      const fitting = parts.map((part) => versesOfQuote(part, verses));
      const inWords = fitting.filter((ayahs) => ayahs.includes(verse.ayah));
      const inShortWords: boolean =
        (hasNumber || (afterChosen && parts.every((part) => !isLongQuote(part)))) &&
        parts.some((part) => isPartOfVerse(part, text));
      matches = inWords.length > 0 || inShortWords;
      if (matches && !hasNumber) {
        for (const ayah of inWords.flat()) if (ayah !== verse.ayah) otherVerses.add(ayah);
      }
    }
    if (matches) {
      chosen.add(heading);
      certain &&= hasNumber && verses !== null;
    }
    afterChosen = matches;
  }
  const unnumbered = quoted.some((heading) => heading.verses?.from === null);
  if (chosen.size === 0) {
    const reason =
      !verses && unnumbered
        ? "not checked: its headings quote verses without their numbers, and no Tanzil file was given"
        : "no heading in its table of contents quotes this verse";
    return missing(headings, verse.surah, reason, surahPage);
  }
  const notes: string[] = [];
  if (otherVerses.size > 0) {
    const list = [...otherVerses].sort((a, b) => a - b).map((ayah) => `${verse.surah}:${ayah}`);
    notes.push(
      `The quoted words are also in ${list.join(", ")}, so some pages may be about those.`,
    );
  }
  if (!verses) {
    notes.push("The printed verse number wasn't checked against the words (no Tanzil file given).");
  }
  if (!verses && unnumbered) {
    notes.push(
      "Headings that quote verses without numbers weren't checked (no Tanzil file given).",
    );
  }
  return {
    kind: "sections",
    foundBy: certain ? "toc" : "quoted-heading",
    sections: sectionsOf(headings, (heading) => chosen.has(heading), new Set(["quote"])),
    notes,
  };
}

/**
 * Where the book discusses the verse: pages to copy, a range of pages to search, or the reason
 * there is neither. `verses` is the surah's text from Tanzil, or null if none was given.
 */
export function locateVerse(
  book: ExportBook,
  verse: VerseRef,
  verseCount: number,
  names: SurahNames,
  verses: SurahVerses | null,
): Location {
  const headings = readHeadings(book, names);
  const pages = surahPages(headings, verse.surah);
  if (!pages) return missing(headings, verse.surah, "no heading for this surah", null);

  const inSurah = headings.filter((heading) => heading.surahs.includes(verse.surah));
  const numbered = inSurah.filter((heading) => heading.verses && heading.verses.style !== "quote");
  if (numbered.length > 0) {
    const styles = new Set(["surah-range", "range", "number"]);
    const exact = numbered.filter((heading) => covers(heading.verses, verse.ayah));
    const coversAll = ({ verses }: Heading) =>
      covers(verses, 1) && covers(verses, verseCount) && verseCount > LONG_SURAH;
    if (exact.length > 0 && exact.every(coversAll)) return { kind: "search", ...pages };
    // Verses come in order, so a heading that breaks the order may have a misprinted number.
    const inOrder = longestRun(numbered, (a, b) => (a.verses?.from ?? 0) <= (b.verses?.from ?? 0));
    const trusted = exact.filter((heading) => inOrder.includes(heading));
    if (exact.length > 0) {
      const chosen = trusted.length > 0 ? trusted : exact;
      return {
        kind: "sections",
        foundBy: trusted.length > 0 ? "toc" : "out-of-order",
        sections: sectionsOf(headings, (heading) => chosen.includes(heading), styles),
        notes: [],
      };
    }
    return (
      locateUnderPreviousNumber(headings, inOrder, verse, styles) ??
      missing(
        headings,
        verse.surah,
        "no heading for this verse in its table of contents",
        pages.from,
      )
    );
  }

  const quoted = inSurah.filter((heading) => heading.verses?.style === "quote");
  if (quoted.length > 0) return locateByQuote(headings, quoted, verse, verses, pages.from);
  return { kind: "search", ...pages };
}

/** In books whose sections run from one verse number to the next: the section before the verse. */
function locateUnderPreviousNumber(
  headings: readonly Heading[],
  numbered: readonly Heading[],
  verse: VerseRef,
  styles: ReadonlySet<string>,
): Location | null {
  const numbers = numbered.flatMap((heading) =>
    heading.verses?.style === "number"
      ? [{ heading, from: heading.verses.from, to: heading.verses.to }]
      : [],
  );
  // A book that also names ranges says exactly which verses each section covers.
  if (numbers.length < numbered.length || numbers.some(({ from, to }) => to > from)) return null;
  const previous = numbers.filter(({ from }) => from < verse.ayah);
  if (previous.length === 0) return null;
  const nearest = previous.reduce((a, b) => (b.from > a.from ? b : a));
  const following = numbers.map(({ from }) => from).filter((from) => from > verse.ayah);
  if (following.length === 0 && verse.ayah - nearest.from > MAX_VERSES_AFTER_LAST_HEADING) {
    return null;
  }
  const next =
    following.length > 0
      ? `the next heading is for verse ${Math.min(...following)}`
      : "it is the last heading of the surah";
  return {
    kind: "sections",
    foundBy: "previous-heading",
    sections: sectionsOf(headings, (heading) => heading === nearest.heading, styles),
    notes: [
      `No heading for verse ${verse.ayah}. This is the section of verse ${nearest.from} (${next}).`,
    ],
  };
}
