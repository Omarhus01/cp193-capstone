import { describe, expect, it } from "vitest";
import { locateVerse } from "./locate";
import { book, names } from "./test-data";
import type { ExportBook, Location, SurahVerses } from "./types";

const VERSE_COUNT = 176;

function locate(
  exportBook: ExportBook,
  ayah: number,
  verses: SurahVerses | null = null,
  surah = 4,
): Location {
  return locateVerse(exportBook, { surah, ayah }, VERSE_COUNT, names, verses);
}

/** "from-end" of each section; the end is the page of the heading that ends it, or "…". */
function pages(location: Location): string[] {
  if (location.kind !== "sections") return [location.kind];
  return location.sections.map(({ from, endsAt }) => `${from}-${endsAt?.pageId ?? "…"}`);
}

const foundBy = (location: Location) =>
  location.kind === "sections" ? location.foundBy : location.kind;

describe("locateVerse in a book with a number for each section", () => {
  const numbers = book([
    ["مقدمة", 1],
    ["البقرة", 5],
    ["٣٤", 6, 2],
    ["النساء", 20],
    ["٣٢", 20, 4],
    ["٣٤", 25, 4],
    ["٣٦", 30, 4],
    ["المائدة", 40],
    ["٣٤", 41, 8],
  ]);

  it("takes the verse's section, in the right surah, up to the next heading", () => {
    const found = locate(numbers, 34);
    expect(pages(found)).toEqual(["25-30"]);
    expect(foundBy(found)).toBe("toc");
  });

  it("ends the surah's last section at the next surah", () => {
    expect(pages(locate(numbers, 36))).toEqual(["30-40"]);
  });

  it("falls back to the section before, and says so", () => {
    const found = locate(numbers, 35);
    expect(pages(found)).toEqual(["25-30"]);
    expect(foundBy(found)).toBe("previous-heading");
    expect(found).toMatchObject({ notes: [expect.stringContaining("section of verse 34")] });
  });

  it("finds nothing before the first heading or far past the last", () => {
    expect(locate(numbers, 31)).toMatchObject({ kind: "missing", surahPage: 20 });
    expect(locate(numbers, 100)).toMatchObject({ kind: "missing", surahPage: 20 });
  });

  it("doesn't fall back in a book that names ranges", () => {
    const ranges = book([
      ["(سورة النساء)", 1],
      ["٣١ - ٣٣", 2, 1],
      ["٣٦", 4, 1],
    ]);
    expect(pages(locate(ranges, 32))).toEqual(["2-4"]);
    expect(locate(ranges, 35)).toMatchObject({ kind: "missing" });
  });

  it("labels a heading whose number breaks the order", () => {
    const misprint = book([
      ["النساء", 1],
      ["١", 1, 1],
      ["٦١", 5, 1],
      ["٣", 7, 1],
      ["٦٤", 9, 1],
      ["٧٠", 11, 1],
    ]);
    expect(foundBy(locate(misprint, 3))).toBe("out-of-order");
    expect(foundBy(locate(misprint, 64))).toBe("toc");
  });
});

describe("locateVerse in a book with ranges", () => {
  const ranges = book([
    ["سورة النساء", 10],
    ["[سورة النساء (٤) : آية ٣٣]", 11, 1],
    ["[سورة النساء (٤) : الآيات ٣٤ إلى ٣٥]", 13, 1],
    ["تنبيه:", 14, 3],
    ["[سورة النساء (٤) : آية ٣٨]", 17, 1],
  ]);

  it("takes the range that holds the verse, with its subheadings", () => {
    expect(pages(locate(ranges, 35))).toEqual(["13-17"]);
  });

  it("finds nothing for a verse outside every range", () => {
    expect(locate(ranges, 36)).toMatchObject({ kind: "missing" });
  });

  it("searches the pages when one heading covers a long surah", () => {
    const whole = book([
      ["سورة النساء", 10],
      ["[سورة النساء (٤) : الآيات ١ إلى ١٧٦]", 11, 1],
      ["سورة المائدة", 90],
    ]);
    expect(locate(whole, 34)).toEqual({ kind: "search", from: 10, to: 90 });
  });

  it("reads the surah of a one-surah book from its title", () => {
    const one = book(
      [
        ["تقديم", 1],
        ["الآية (٣)", 5],
        ["من فوائد الآية الكريمة", 6],
        ["الآيتان (٤، ٥)", 8],
      ],
      "تفسير العثيمين: لقمان",
    );
    expect(pages(locate(one, 3, null, 31))).toEqual(["5-8"]);
    expect(pages(locate(one, 5, null, 31))).toEqual(["8-…"]);
    expect(locate(one, 3)).toMatchObject({ kind: "missing", surahPage: null });
  });

  it("joins headings of the same verse, and leaves out a later one that breaks the order", () => {
    const repeated = book([
      ["سورة النساء", 1],
      ["الآية (٧) نص", 2, 1],
      ["الآية (٧) تتمة", 3, 1],
      ["الآية (٨)", 5, 1],
      ["الآية (٧) عودة", 9, 1],
      ["الآية (٩)", 11, 1],
    ]);
    expect(pages(locate(repeated, 7))).toEqual(["2-5"]);
  });
});

describe("locateVerse and surah headings the export gets wrong", () => {
  const mislabelled = book([
    ["الفاتحة", 1],
    ["البقرة", 5],
    ["١", 5, 2],
    ["آل عمران", 10],
    ["١", 10, 4],
    // Really the next surah's first verses, under the wrong name.
    ["البقرة", 20],
    ["٢", 20, 6],
    ["النساء", 22],
    ["٥", 22, 8],
    ["المائدة", 30],
  ]);

  it("doesn't take pages from under an out-of-order surah heading", () => {
    expect(locate(mislabelled, 2, null, 2)).toMatchObject({
      foundBy: "previous-heading",
      sections: [{ from: 5 }],
    });
  });

  it("points to the heading when the surah next to it lacks the verse", () => {
    expect(locate(mislabelled, 2)).toMatchObject({
      kind: "missing",
      reason: expect.stringContaining("out of order"),
      surahPage: 20,
    });
  });
});

describe("locateVerse in a book that quotes the verse", () => {
  // Placeholder sentences, not verses. The fourth is the one looked for.
  const verses = [
    "نَصٌّ أَوَّلُ لِلتَّجۡرِبَةِ",
    "نَصٌّ ثَانٍ لِلتَّجۡرِبَةِ وَٱلۡفَحۡصِ",
    "نَصٌّ ثَالِثٌ مِنۡ غَيۡرِ كِتَابٍ",
    "جُمۡلَةٌ رَابِعَةٌ فِيهَا ٱلۡكَلِمَٰتُ ٱلۡقَلِيلَةُ",
  ];
  const quotes = book([
    ["سورة النساء", 1],
    ["قوله تعالى: ﴿نص ثالث من غير كتاب (٣)﴾", 2, 1],
    ["قوله تعالى: ﴿جملة رابعة فيها﴾", 4, 1],
    ["قوله تعالى: ﴿الكلمات﴾", 5, 1],
    ["قوله تعالى: ﴿نص أول للتجربة﴾", 8, 1],
  ]);

  it("matches the words, goes on with a short quote, and labels the result", () => {
    const found = locate(quotes, 4, verses);
    expect(pages(found)).toEqual(["4-8"]);
    expect(foundBy(found)).toBe("quoted-heading");
  });

  it("trusts a printed number only when the words agree", () => {
    expect(foundBy(locate(quotes, 3, verses))).toBe("toc");
    const misprint = book([
      ["سورة النساء", 1],
      ["قوله تعالى: ﴿نص ثالث من غير كتاب (٤)﴾", 2, 1],
    ]);
    expect(locate(misprint, 4, verses)).toMatchObject({ kind: "missing" });
    expect(pages(locate(misprint, 3, verses))).toEqual(["2-…"]);
  });

  it("says when the words fit other verses too", () => {
    const common = book([
      ["سورة النساء", 1],
      ["قوله تعالى: ﴿نص للتجربة والفحص﴾", 2, 1],
    ]);
    const similar = [
      "نَصٌّ لِلتَّجۡرِبَةِ وَٱلۡفَحۡصِ أَوَّلًا",
      "نَصٌّ لِلتَّجۡرِبَةِ وَٱلۡفَحۡصِ ثَانِيًا",
    ];
    expect(locate(common, 1, similar)).toMatchObject({
      notes: [expect.stringContaining("4:2")],
    });
  });

  it("without the Tanzil file, uses printed numbers with a label and lists the rest", () => {
    expect(foundBy(locate(quotes, 3))).toBe("quoted-heading");
    expect(locate(quotes, 4)).toMatchObject({
      kind: "missing",
      reason: expect.stringContaining("not checked"),
    });
  });
});

describe("locateVerse in a book with surah headings only", () => {
  it("gives the surah's pages to search", () => {
    const surahs = book([
      ["تفسير سورة آل عمران", 10],
      ["تفسير سورة النساء", 20],
      ["فصل", 25, 2],
      ["تفسير سورة المائدة", 30],
    ]);
    expect(locate(surahs, 34)).toEqual({ kind: "search", from: 20, to: 30 });
    expect(locate(surahs, 1, null, 5)).toEqual({ kind: "search", from: 30, to: null });
  });
});
