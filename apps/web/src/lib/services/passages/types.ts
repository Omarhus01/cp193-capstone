// The Athars export as the passage finder sees it (content/README.md, "Finding passages for a new
// verse"). Nothing in this folder reads files; scripts/export.ts does.

/** One heading of a book's table of contents (`<book>.toc.json`). `parent` 0 is the top level. */
export type TocEntry = { id: number; title: string; parent: number; page_id: number };

/** One page of a book, a line of `<book>.jsonl`. */
export type ExportPage = {
  book_id: number;
  page_id: number;
  page_num: number | null;
  part_title: string;
  display_elem: string;
};

/** A book: its Shamela id, its title and its table of contents in order. */
export type ExportBook = { id: number; title: string; toc: TocEntry[] };

export type VerseRef = { surah: number; ayah: number };

/** The verse texts of one surah, in order, used only to match headings that quote a verse. */
export type SurahVerses = readonly string[];

/** Pages to copy. The verse's section ends at the heading `endsAt`, or at the end of the book. */
export type PlannedSection = {
  from: number;
  endsAt: { tocId: number; pageId: number } | null;
  headings: string[];
};

/** How a book's pages were found. Everything but "toc" is shown as needing a check. */
export type FoundBy =
  "toc" | "out-of-order" | "previous-heading" | "quoted-heading" | "page-search";

/** Where to look in a book, decided from its table of contents alone. */
export type Location =
  | { kind: "sections"; foundBy: FoundBy; sections: PlannedSection[]; notes: string[] }
  | { kind: "search"; from: number; to: number | null }
  | { kind: "missing"; reason: string; surahPage: number | null };

/** A run of pages that discusses the verse, with the pages just before and after it. */
export type FoundSection = {
  pages: ExportPage[];
  headings: string[];
  previousPageId: number | null;
  nextPageId: number | null;
};

export type BookResult = { book: ExportBook } & (
  | { kind: "found"; foundBy: FoundBy; sections: FoundSection[]; notes: string[] }
  | { kind: "missing"; reason: string; surahPage: number | null }
);
