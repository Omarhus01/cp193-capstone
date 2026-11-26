// Made-up books for the tests. The Arabic is placeholder text ("test text"), never verses or
// passages of real books.
import { SurahNames } from "./surah-names";
import type { ExportBook, ExportPage, TocEntry } from "./types";

export const names = new SurahNames([
  { number: 1, nameAr: "الفاتحة" },
  { number: 2, nameAr: "البقرة" },
  { number: 3, nameAr: "آل عمران" },
  { number: 4, nameAr: "النساء" },
  { number: 5, nameAr: "المائدة" },
  { number: 31, nameAr: "لقمان" },
  { number: 47, nameAr: "محمد" },
]);

/** A table of contents from [title, page, parent title's position from 1 (0: top level)]. */
export function book(
  headings: readonly (readonly [string, number, number?])[],
  title = "كتاب تجريبي",
): ExportBook {
  const toc: TocEntry[] = headings.map(([heading, page, parent], i) => ({
    id: i + 1,
    title: heading,
    parent: parent ?? 0,
    page_id: page,
  }));
  return { id: 9001, title, toc };
}

/** A page with this HTML, printed as page `id + 10` of volume 1. */
export function page(id: number, html: string): ExportPage {
  return {
    book_id: 9001,
    page_id: id,
    page_num: id + 10,
    part_title: "١",
    display_elem:
      '<div class="PageText"><div class="PageHead"><span class="PartName">كتاب تجريبي - جـ ١</span>' +
      `<span class="PageNumber">(ص: ${id + 10})</span><hr/></div>${html}</div>`,
  };
}

/** A heading's mark in a page, as Shamela writes it. */
export function mark(tocId: number, text: string): string {
  return `\u200c<span data-type="title" id="toc-${tocId}">\u200c${text}</span>`;
}
