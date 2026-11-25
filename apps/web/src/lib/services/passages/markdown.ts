// The finder's result as one markdown file. Everything in Arabic is the books' own text.
import { westernDigits } from "./arabic";
import { pageHead, pageText, volumeOf } from "./page-text";
import type { BookResult, ExportPage, FoundBy, VerseRef } from "./types";

type Found = Extract<BookResult, { kind: "found" }>;
type Missing = Extract<BookResult, { kind: "missing" }>;

const FOUND_BY: Record<FoundBy, string> = {
  toc: "table of contents",
  "out-of-order": "**check:** heading with this number, but out of order",
  "previous-heading": "**check:** section of an earlier verse, no heading for this one",
  "quoted-heading": "**check:** heading that quotes the verse",
  "page-search": "**check:** verse number in the pages, not the table of contents",
};

export function shamelaUrl(bookId: number, pageId: number): string {
  return `https://shamela.ws/book/${bookId}/${pageId}`;
}

const anchor = ({ book }: BookResult) => `book-${book.id}`;

const pageCount = ({ sections }: Found) =>
  new Set(sections.flatMap(({ pages }) => pages.map((page) => page.page_id))).size;

function printed(page: ExportPage): { volume: string; number: string } {
  const { partName, pageNumber } = pageHead(page.display_elem);
  const volume = volumeOf(partName, page.part_title);
  return {
    volume: volume === null ? "" : `vol. ${westernDigits(volume)}, `,
    number: westernDigits(String(page.page_num ?? pageNumber)),
  };
}

function printedRange(pages: readonly ExportPage[]): string {
  const first = printed(pages[0]);
  const last = printed(pages[pages.length - 1]);
  if (first.volume !== last.volume) {
    return `${first.volume}p. ${first.number} – ${last.volume}p. ${last.number}`;
  }
  return first.number === last.number
    ? `${first.volume}p. ${first.number}`
    : `${first.volume}pp. ${first.number}–${last.number}`;
}

/** Lines as paragraphs, right to left. The text isn't escaped, so it can be copied as it is. */
function arabic(text: string): string {
  return `<div dir="rtl" lang="ar">\n\n${text.split("\n").join("\n\n")}\n\n</div>`;
}

function pageBlocks(bookId: number, page: ExportPage): string[] {
  const { volume, number } = printed(page);
  const { text, footnotes } = pageText(page.display_elem);
  const onPage = westernDigits(pageHead(page.display_elem).pageNumber);
  const blocks = [
    `### ${volume}p. ${number} · [Shamela](${shamelaUrl(bookId, page.page_id)})`,
    text === "" ? "(no text on this page)" : arabic(text),
  ];
  if (onPage !== "" && onPage !== number) {
    blocks.splice(1, 0, `**Check:** the page itself is numbered ${onPage}.`);
  }
  if (footnotes !== "") blocks.push("Footnotes:", arabic(footnotes));
  return blocks;
}

function bookBlocks(result: Found): string[] {
  const { book, sections, foundBy, notes } = result;
  const about = [
    `- Found by: ${FOUND_BY[foundBy]}`,
    ...notes.map((note) => `- **Check:** ${note}`),
  ];
  const blocks = [`<a id="${anchor(result)}"></a>`, `## ${book.title}`, about.join("\n")];
  for (const { pages, headings, previousPageId, nextPageId } of sections) {
    const lines = [`- Pages: ${printedRange(pages)}`];
    if (headings.length > 0) lines.push(`- Headings: ${headings.join(" | ")}`);
    if (previousPageId !== null) {
      lines.push(`- Page before: <${shamelaUrl(book.id, previousPageId)}>`);
    }
    if (nextPageId !== null) lines.push(`- Page after: <${shamelaUrl(book.id, nextPageId)}>`);
    blocks.push(lines.join("\n"), ...pages.flatMap((page) => pageBlocks(book.id, page)));
  }
  blocks.push("[Back to the list](#books)");
  return blocks;
}

function missingLine({ book, reason, surahPage }: Missing): string {
  const link = surahPage === null ? "" : ` ([look here](${shamelaUrl(book.id, surahPage)}))`;
  return `- ${book.title}: ${reason}${link}`;
}

/** The whole file. Books found through their table of contents come first. */
export function passagesMarkdown(verse: VerseRef, results: readonly BookResult[]): string {
  const found = results
    .filter((result) => result.kind === "found")
    .sort((a, b) => Number(a.foundBy !== "toc") - Number(b.foundBy !== "toc"));
  const missing = results.filter((result) => result.kind === "missing");
  const notFound = missing.filter(({ surahPage }) => surahPage !== null);
  const otherSurahs = missing.filter(({ surahPage }) => surahPage === null);
  const rows = found.map((result) => {
    const link = `[${result.book.title.replace(/\|/g, "\\|")}](#${anchor(result)})`;
    const where = result.sections.map(({ pages }) => printedRange(pages)).join("; ");
    return `| ${link} | ${pageCount(result)} | ${where} | ${FOUND_BY[result.foundBy]} |`;
  });
  const table = [
    "| Book | Pages | Printed pages | Found by |",
    "| --- | --- | --- | --- |",
    ...rows,
  ];
  const blocks = [
    `# Passages on ${verse.surah}:${verse.ayah}`,
    "Source text copied from the Athars export, for reading. Pages are copied whole, so the first " +
      "and last page of a section can also hold text about other verses. Volumes and pages are " +
      "those of the export's edition, which can differ from the edition already cited for a book.",
    '<a id="books"></a>',
    `## Books (${found.length})`,
    rows.length > 0 ? table.join("\n") : "No book was found.",
    ...found.flatMap(bookBlocks),
  ];
  if (notFound.length > 0) {
    blocks.push(`## Not found (${notFound.length})`, notFound.map(missingLine).join("\n"));
  }
  if (otherSurahs.length > 0) {
    blocks.push(
      `## No heading for this surah (${otherSurahs.length})`,
      otherSurahs.map(({ book }) => `- ${book.title}`).join("\n"),
    );
  }
  return `${blocks.join("\n\n")}\n`;
}
