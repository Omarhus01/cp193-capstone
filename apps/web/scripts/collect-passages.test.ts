// The finder over a small made-up export (test-export/). Its Arabic is placeholder text, not text
// of the Quran or of real books.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { passagesMarkdown } from "@/lib/services/passages/markdown";
import { pageText } from "@/lib/services/passages/page-text";
import type { BookResult } from "@/lib/services/passages/types";
import { collectPassages, surahVerses } from "./collect-passages";
import { assertOutside, listBooks, readBook, readPages } from "./export";

const EXPORT = fileURLToPath(new URL("./test-export", import.meta.url));
const REPOSITORY = fileURLToPath(new URL("../../..", import.meta.url));

const surahs = [
  { number: 2, nameAr: "البقرة", verseCount: 6 },
  { number: 4, nameAr: "النساء", verseCount: 6 },
  { number: 5, nameAr: "المائدة", verseCount: 3 },
  { number: 31, nameAr: "لقمان", verseCount: 3 },
];

// Shaped like Tanzil's file, with placeholder sentences instead of verses.
const sentences = [
  "أ",
  "ب",
  "فِيهَا ٱلۡكَلِمَٰتُ ٱلتَّجۡرِيبِيَّةُ لِلۡفَحۡصِ فَقَطۡ",
  "د",
  "ه",
  "و",
];
const tanzilXml = `<sura index="4" name="x">${sentences
  .map((text, i) => `<aya index="${i + 1}" text="${text}" />`)
  .join("\n")}</sura>`;

const verse = { surah: 4, ayah: 3 };

async function find(tanzil: string | null = null): Promise<Map<number, BookResult>> {
  const results = await collectPassages(EXPORT, verse, surahs, tanzil);
  return new Map(results.map((result) => [result.book.id, result]));
}

function pageIds(result: BookResult | undefined): number[] {
  return result?.kind === "found"
    ? result.sections.flatMap((section) => section.pages.map((page) => page.page_id))
    : [];
}

describe("collectPassages", () => {
  it("follows a section to the page where the next heading starts", async () => {
    const result = (await find()).get(9001);
    expect(result).toMatchObject({ kind: "found", foundBy: "toc" });
    expect(pageIds(result)).toEqual([4, 5, 6]);
  });

  it("reads only the page itself from a damaged record, and copes with missing pages", async () => {
    const result = (await find()).get(9002);
    expect(result?.book.title).toBe("كتاب المدى التجريبي");
    expect(pageIds(result)).toEqual([3, 4]);
    const first = result?.kind === "found" ? result.sections[0].pages[0] : undefined;
    expect(pageText(first?.display_elem ?? "").text).toBe("[الآيات 3 إلى 4] نص المدى التجريبي");
  });

  it("searches the pages of a book that lists surahs only, and labels it", async () => {
    const result = (await find()).get(9003);
    expect(result).toMatchObject({ kind: "found", foundBy: "page-search" });
    expect(pageIds(result)).toEqual([2, 3]);
  });

  it("matches quoted headings only with the Tanzil file", async () => {
    expect((await find()).get(9004)).toMatchObject({
      kind: "missing",
      reason: expect.stringContaining("not checked"),
    });
    const result = (await find(tanzilXml)).get(9004);
    expect(result).toMatchObject({ kind: "found", foundBy: "quoted-heading" });
    expect(pageIds(result)).toEqual([2]);
  });

  it("leaves out a book on another surah", async () => {
    expect((await find()).get(9005)).toMatchObject({ kind: "missing", surahPage: null });
  });

  it("writes every book into the markdown, with the text as it is", async () => {
    const text = passagesMarkdown(verse, [...(await find(tanzilXml)).values()]);
    expect(text).toContain("## Books (4)");
    expect(text).toContain("| [كتاب الأرقام التجريبي](#book-9001) | 3 | vol. 1, pp. 104–106 |");
    expect(text).toContain("[Shamela](https://shamela.ws/book/9001/5)");
    expect(text).toContain("(3) نَصٌّ تَجْرِيبِيٌّ أوَّل\n\nسطر ثان(1)");
    expect(text).toContain("(1) حاشية تجريبية");
    expect(text).not.toContain("ملتصقة");
    expect(text).not.toMatch(/<(span|p|font|hr)\b/);
  });

  it("refuses a verse that doesn't exist", async () => {
    await expect(collectPassages(EXPORT, { surah: 4, ayah: 7 }, surahs, null)).rejects.toThrow(
      "There is no verse 4:7",
    );
  });

  it("refuses a Tanzil file with the wrong number of verses", () => {
    expect(() => surahVerses(tanzilXml, { ...surahs[1], verseCount: 7 })).toThrow("6 verses");
  });
});

describe("export files", () => {
  it("lists the books and reads a title from a book that starts at page 2", async () => {
    expect(listBooks(EXPORT)).toEqual([9001, 9002, 9003, 9004, 9005]);
    expect((await readBook(EXPORT, 9002)).title).toBe("كتاب المدى التجريبي");
  });

  it("reads a range of pages", async () => {
    const pages = await readPages(EXPORT, 9001, 3, 5);
    expect(pages.map((page) => page.page_id)).toEqual([3, 4, 5]);
  });

  it("refuses a folder without an export", () => {
    expect(() => listBooks(path.join(EXPORT, ".."))).toThrow("has no .toc.json files");
  });

  it("refuses to write inside the repository", () => {
    expect(() => assertOutside(REPOSITORY, path.join(EXPORT, "found", "4-3.md"))).toThrow(
      "inside the repository",
    );
    expect(() => assertOutside(REPOSITORY, REPOSITORY)).toThrow("inside the repository");
    expect(() => assertOutside(REPOSITORY, path.join(os.tmpdir(), "4-3.md"))).not.toThrow();
    expect(() =>
      assertOutside(REPOSITORY, path.join(REPOSITORY, "..", "..neighbour", "4-3.md")),
    ).not.toThrow();
  });
});
