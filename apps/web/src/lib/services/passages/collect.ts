// The pages of a book that discuss the verse, once the pages around them have been read.
import { searchPages } from "./page-marks";
import { hasTextBeforeHeading } from "./page-text";
import type { SurahNames } from "./surah-names";
import type { BookResult, ExportBook, ExportPage, FoundSection, Location, VerseRef } from "./types";

/**
 * The page ids to read for a location, with one page on each side. `to` null means to the end of
 * the book. Null if there is nothing to read.
 */
export function pagesToRead(location: Location): { from: number; to: number | null } | null {
  if (location.kind === "missing") return null;
  if (location.kind === "search") {
    return { from: location.from - 1, to: location.to === null ? null : location.to + 1 };
  }
  const starts = location.sections.map((section) => section.from);
  const ends = location.sections.map((section) => section.endsAt?.pageId ?? Infinity);
  const last = Math.max(...ends);
  return { from: Math.min(...starts) - 1, to: last === Infinity ? null : last + 1 };
}

function section(
  pages: readonly ExportPage[],
  from: number,
  to: number,
  headings: string[],
): FoundSection {
  const ifRead = (id: number) => (pages.some((page) => page.page_id === id) ? id : null);
  return {
    pages: pages.filter((page) => page.page_id >= from && page.page_id <= to),
    headings,
    previousPageId: ifRead(from - 1),
    nextPageId: ifRead(to + 1),
  };
}

/** The book's result, from its location and the pages `pagesToRead` asked for. */
export function collectPages(
  book: ExportBook,
  location: Location,
  pages: readonly ExportPage[],
  verse: VerseRef,
  verseCount: number,
  names: SurahNames,
): BookResult {
  if (location.kind === "missing") return { book, ...location };
  if (location.kind === "search") {
    const { from, to } = location;
    const inSurah = pages.filter(
      (page) => page.page_id >= from && (to === null || page.page_id <= to),
    );
    const runs = searchPages(inSurah, verse, verseCount, names);
    if (runs.length === 0) {
      const reason =
        "its table of contents lists surahs only, and the verse's number wasn't found in its pages";
      return { book, kind: "missing", reason, surahPage: from };
    }
    const sections = runs.map((run) => section(pages, run.from, run.to, []));
    return { book, kind: "found", foundBy: "page-search", sections, notes: [] };
  }

  const lastPage = pages.at(-1)?.page_id ?? 0;
  const sections: FoundSection[] = [];
  let last: { from: number; to: number; headings: string[] } | null = null;
  for (const { from, endsAt, headings } of location.sections) {
    let to = lastPage;
    if (endsAt) {
      const endPage = pages.find((page) => page.page_id === endsAt.pageId);
      const reaches = endPage && hasTextBeforeHeading(endPage.display_elem, endsAt.tocId);
      to = Math.max(from, reaches ? endsAt.pageId : endsAt.pageId - 1);
    }
    // Sections that share a page are copied as one, so no page comes twice.
    if (last && from <= last.to) {
      sections.pop();
      last = {
        from: last.from,
        to: Math.max(last.to, to),
        headings: [...last.headings, ...headings],
      };
    } else {
      last = { from, to, headings };
    }
    sections.push(section(pages, last.from, last.to, last.headings));
  }
  return { book, kind: "found", foundBy: location.foundBy, sections, notes: location.notes };
}
