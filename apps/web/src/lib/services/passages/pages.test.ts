import { describe, expect, it } from "vitest";
import { collectPages, pagesToRead } from "./collect";
import { passagesMarkdown } from "./markdown";
import { searchPages } from "./page-marks";
import { bookTitle, hasTextBeforeHeading, pageHead, pageText, volumeOf } from "./page-text";
import { book, mark, names, page } from "./test-data";
import type { BookResult, Location } from "./types";

describe("pageText", () => {
  it("removes the HTML and keeps the text as it is", () => {
    const { text, footnotes } = pageText(
      page(
        1,
        `${mark(3, "عُنْوَانٌ")}<p></p>نَصٌّ {تَجْرِيبِيٌّ} (1) <font color="#be0000">…</font> ٣ &lt; ٤<sup>2</sup>` +
          '<p></p> <p></p>سطر<hr align="right" width="95"/><div class="footnote">(1) حاشية<p></p>2 أخرى</div>',
      ).display_elem,
    );
    expect(text).toBe("عُنْوَانٌ\nنَصٌّ {تَجْرِيبِيٌّ} (1) … ٣ < ٤2\nسطر");
    expect(footnotes).toBe("(1) حاشية\n2 أخرى");
  });

  it("reads only the page itself from a damaged record", () => {
    const damaged = page(1, "الصفحة نفسها").display_elem + page(2, "صفحة أخرى").display_elem;
    expect(pageText(damaged).text).toBe("الصفحة نفسها");
    expect(pageHead(damaged)).toEqual({ partName: "كتاب تجريبي - جـ ١", pageNumber: "11" });
  });

  it("tells the title from the volume", () => {
    expect(bookTitle("كتاب تجريبي - جـ ١", "١")).toBe("كتاب تجريبي");
    expect(volumeOf("كتاب تجريبي - جـ ١", "١")).toBe("١");
    expect(volumeOf("كتاب تجريبي - المقدمة", "المقدمة")).toBe("المقدمة");
    expect(bookTitle("كتاب - ط دار - جـ ٢", "٢")).toBe("كتاب - ط دار");
    expect(volumeOf("كتاب: الأول - الثاني", "كتاب: الأول - الثاني")).toBeNull();
  });

  it("knows whether text comes before a heading's mark", () => {
    const first = page(1, `${mark(7, "عنوان")}<p></p>نص`).display_elem;
    const middle = page(1, `نص<p></p>${mark(7, "عنوان")}`).display_elem;
    expect(hasTextBeforeHeading(first, 7)).toBe(false);
    expect(hasTextBeforeHeading(middle, 7)).toBe(true);
    expect(hasTextBeforeHeading(first, 8)).toBe(true);
  });
});

const verse = { surah: 4, ayah: 34 };
const search = (pages: ReturnType<typeof page>[]) => searchPages(pages, verse, 176, names);

describe("searchPages", () => {
  it("finds numbers in quotes and ignores footnote numbers that look the same", () => {
    const pages = [
      page(1, "{نص (32)} شرح {كلمة (5)} شرح"),
      page(2, "{نص (33)} شرح"),
      page(3, "تتمة {نص (34)} شرح"),
      page(4, "شرح {كلمة (1)} شرح"),
      page(5, "تتمة ثم {نص (35)} شرح {نص (36)}"),
    ];
    expect(search(pages)).toEqual([{ from: 3, to: 5 }]);
  });

  it("takes quotes in a row as one group", () => {
    const pages = [page(1, "{نص (33)} {نص (34)} {نص (35)}"), page(2, "شرح"), page(3, "{نص (36)}")];
    expect(search(pages)).toEqual([{ from: 1, to: 3 }]);
  });

  it("finds references after quotes, in this surah only", () => {
    const pages = [
      page(1, "{نص} [النساء: 33]"),
      page(2, "{نص} [النساء: 34]"),
      page(3, "بقية الرواية"),
      page(4, "{نص} [البقرة: 34]"),
      page(5, "{نص} [النساء: 35]"),
    ];
    expect(search(pages)).toEqual([{ from: 2, to: 4 }]);
  });

  it("finds numbers at the start of lines", () => {
    const pages = [
      page(1, "(33) … {كلمة} … شرح<p></p>(34) … {كلمة} … شرح"),
      page(2, "(34) … {كلمة} … شرح<p></p>(35) … {كلمة} … شرح"),
    ];
    expect(search(pages)).toEqual([{ from: 1, to: 2 }]);
  });

  it("finds numbers at the end of what is said about a verse", () => {
    const pages = [page(1, "نص - 32- نص - 33-"), page(2, "شرح"), page(3, "تتمة - 34- نص - 35-")];
    expect(search(pages)).toEqual([{ from: 1, to: 3 }]);
  });

  it("finds nothing in pages without numbers", () => {
    expect(search([page(1, "نص"), page(2, "نص")])).toEqual([]);
  });
});

describe("collectPages", () => {
  const exportBook = book([["النساء", 1]]);
  const sections = (
    ...list: { from: number; endsAt: { tocId: number; pageId: number } | null }[]
  ): Location => ({
    kind: "sections",
    foundBy: "toc",
    sections: list.map((section) => ({ ...section, headings: ["٣٤"] })),
    notes: [],
  });
  const all = [
    page(1, "قبل"),
    page(2, "نص"),
    page(3, "تتمة"),
    page(4, `آخر النص<p></p>${mark(9, "٣٥")}`),
    page(5, `${mark(10, "٣٦")} نص`),
    page(6, "بعد"),
  ];
  const ids = (result: BookResult) =>
    result.kind === "found"
      ? result.sections.map((section) => section.pages.map((p) => p.page_id))
      : [];
  const collect = (location: Location) =>
    collectPages(exportBook, location, all, verse, 176, names);

  it("takes the next heading's page only if the section reaches it", () => {
    expect(ids(collect(sections({ from: 2, endsAt: { tocId: 9, pageId: 4 } })))).toEqual([
      [2, 3, 4],
    ]);
    expect(ids(collect(sections({ from: 2, endsAt: { tocId: 10, pageId: 5 } })))).toEqual([
      [2, 3, 4],
    ]);
    // Not marked on its page: the heading could be anywhere on it.
    expect(ids(collect(sections({ from: 2, endsAt: { tocId: 99, pageId: 5 } })))).toEqual([
      [2, 3, 4, 5],
    ]);
  });

  it("takes one page when the next heading is on the same page", () => {
    expect(ids(collect(sections({ from: 5, endsAt: { tocId: 10, pageId: 5 } })))).toEqual([[5]]);
  });

  it("goes to the end of the book when no heading follows", () => {
    expect(ids(collect(sections({ from: 5, endsAt: null })))).toEqual([[5, 6]]);
  });

  it("copies no page twice", () => {
    const location = sections(
      { from: 2, endsAt: { tocId: 9, pageId: 4 } },
      { from: 4, endsAt: { tocId: 10, pageId: 5 } },
    );
    expect(ids(collect(location))).toEqual([[2, 3, 4]]);
  });

  it("asks for one page on each side", () => {
    expect(pagesToRead(sections({ from: 2, endsAt: { tocId: 9, pageId: 4 } }))).toEqual({
      from: 1,
      to: 5,
    });
    expect(pagesToRead(sections({ from: 2, endsAt: null }))).toEqual({ from: 1, to: null });
    expect(pagesToRead({ kind: "missing", reason: "", surahPage: null })).toBeNull();
  });

  it("searches the pages of a surah, and says when nothing is there", () => {
    const pages = [page(1, "{نص (33)}"), page(2, "{نص (34)}"), page(3, "{نص (35)}")];
    const location: Location = { kind: "search", from: 1, to: 3 };
    expect(collectPages(exportBook, location, pages, verse, 176, names)).toMatchObject({
      foundBy: "page-search",
      sections: [{ previousPageId: 1 }],
    });
    expect(collect({ kind: "search", from: 1, to: 6 })).toMatchObject({
      kind: "missing",
      surahPage: 1,
    });
  });
});

describe("passagesMarkdown", () => {
  const found = (foundBy: "toc" | "page-search", id: number, title: string): BookResult => ({
    book: { ...book([]), id, title },
    kind: "found",
    foundBy,
    sections: [
      {
        pages: [
          page(2, 'نص أول<p></p>نص ثان<hr/><div class="footnote">حاشية</div>'),
          page(3, "نص"),
        ],
        headings: ["٣٤"],
        previousPageId: 1,
        nextPageId: null,
      },
    ],
    notes: ["ملاحظة"],
  });
  const text = passagesMarkdown(verse, [
    found("page-search", 9002, "كتاب ثان"),
    found("toc", 9001, "كتاب أول"),
    { book: { ...book([]), title: "ثالث" }, kind: "missing", reason: "سبب", surahPage: 7 },
    { book: { ...book([]), title: "رابع" }, kind: "missing", reason: "سبب", surahPage: null },
  ]);

  it("starts with a list of books, page counts and links to their sections", () => {
    expect(text).toContain(
      "| [كتاب أول](#book-9001) | 2 | vol. 1, pp. 12–13 | table of contents |\n| [كتاب ثان](#book-9002) | 2 |",
    );
    expect(text).toContain('<a id="book-9001"></a>\n\n## كتاب أول');
    expect(text.indexOf("#book-9001")).toBeLessThan(text.indexOf("## كتاب أول"));
  });

  it("links each page to Shamela and shows its text and footnotes", () => {
    expect(text).toContain("### vol. 1, p. 12 · [Shamela](https://shamela.ws/book/9001/2)");
    expect(text).toContain('<div dir="rtl" lang="ar">\n\nنص أول\n\nنص ثان\n\n</div>');
    expect(text).toContain("Footnotes:\n\n");
    expect(text).toContain("- Page before: <https://shamela.ws/book/9001/1>");
  });

  it("labels what needs a check and lists what wasn't found", () => {
    expect(text).toContain("- Found by: **check:** verse number in the pages");
    expect(text).toContain("## Not found (1)\n\n- ثالث: سبب ([look here]");
    expect(text).toContain("## No heading for this surah (1)\n\n- رابع");
  });

  it("says when a page's printed number differs from the export's", () => {
    const odd = { ...page(2, "نص"), page_num: 99 };
    const result = found("toc", 9001, "كتاب");
    if (result.kind === "found") result.sections[0].pages = [odd];
    expect(passagesMarkdown(verse, [result])).toContain("the page itself is numbered 12");
  });
});
