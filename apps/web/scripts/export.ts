// Reading the Athars export: one .jsonl (pages) and one .toc.json (table of contents) per book.
// The export stays outside the repository, and nothing here writes to it.
import { createReadStream, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { z } from "zod";
import { bookTitle, pageHead } from "@/lib/services/passages/page-text";
import type { ExportBook, ExportPage } from "@/lib/services/passages/types";

const tocSchema = z.array(
  z.object({ id: z.number(), title: z.string(), parent: z.number(), page_id: z.number() }),
);
const pageSchema = z.object({
  book_id: z.number(),
  page_id: z.number(),
  page_num: z.number().nullable(),
  part_title: z.string(),
  display_elem: z.string(),
});

const TOC_SUFFIX = ".toc.json";
const PAGE_ID = /^\s*\{\s*"book_id":\s*\d+,\s*"page_id":\s*(\d+)/;

/** The Shamela ids of the books in the folder. */
export function listBooks(exportDir: string): number[] {
  const files = readdirSync(exportDir);
  const books = files
    .filter((file) => file.endsWith(TOC_SUFFIX))
    .map((file) => file.slice(0, -TOC_SUFFIX.length));
  if (books.length === 0) throw new Error(`${exportDir} has no ${TOC_SUFFIX} files.`);
  for (const book of books) {
    if (!/^\d+$/.test(book) || !files.includes(`${book}.jsonl`)) {
      throw new Error(`${book}${TOC_SUFFIX}: expected a book id, with ${book}.jsonl next to it.`);
    }
  }
  return books.map(Number).sort((a, b) => a - b);
}

/**
 * The book's pages from `from` to `to` (null: to the end), at most `limit`. Reads line by line,
 * parses only the wanted pages and stops after the last one, since one book is a gigabyte. Pages
 * are in order, but a few ids are missing and some books start at page 2.
 */
export async function readPages(
  exportDir: string,
  bookId: number,
  from: number,
  to: number | null,
  limit = Infinity,
): Promise<ExportPage[]> {
  const stream = createReadStream(path.join(exportDir, `${bookId}.jsonl`));
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const pages: ExportPage[] = [];
  try {
    for await (const line of lines) {
      if (line.trim() === "") continue;
      const pageId = Number(PAGE_ID.exec(line)?.[1]);
      if (Number.isNaN(pageId)) throw new Error(`${bookId}.jsonl has a line without a page_id.`);
      if (to !== null && pageId > to) break;
      if (pageId >= from) pages.push(pageSchema.parse(JSON.parse(line)));
      if (pages.length >= limit) break;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return pages;
}

/** A book's title (from its first page) and table of contents. */
export async function readBook(exportDir: string, id: number): Promise<ExportBook> {
  const toc = tocSchema.parse(
    JSON.parse(readFileSync(path.join(exportDir, `${id}${TOC_SUFFIX}`), "utf8")),
  );
  const [first] = await readPages(exportDir, id, 0, null, 1);
  const title = first ? bookTitle(pageHead(first.display_elem).partName, first.part_title) : "";
  return { id, title: title || `Book ${id}`, toc };
}

/** Throws if `file` would be inside `repository`: the books' text must not get into it. */
export function assertOutside(repository: string, file: string): void {
  const relative = path.relative(path.resolve(repository), path.resolve(file));
  const isInside =
    relative === "" || (!path.isAbsolute(relative) && relative.split(path.sep)[0] !== "..");
  if (isInside) throw new Error(`${file} is inside the repository. Keep the export outside it.`);
}
