import { describe, expect, it } from "vitest";
import { consonantSkeleton, normalizeArabic, westernDigits } from "./arabic";
import { isPartOfVerse, quoteParts, versesOfQuote } from "./quotes";
import { names } from "./test-data";
import { parseVerseHeading } from "./verse-heading";

describe("Arabic for comparing", () => {
  it("removes diacritics, tatweel and Quran marks, and unifies letter forms", () => {
    expect(normalizeArabic("ٱلۡكَـلِمَةُ ۖ أُخۡرَىٰ ۝")).toBe("الكلمه اخري");
    expect(normalizeArabic("الكلمة أخرى")).toBe("الكلمه اخري");
  });

  it("makes Uthmani and plain spelling alike", () => {
    expect(normalizeArabic("ٱلۡكَلِمَٰتُ")).not.toBe(normalizeArabic("الكلمات"));
    expect(consonantSkeleton("ٱلۡكَلِمَٰتُ")).toBe(consonantSkeleton("الكلمات"));
  });

  it("reads Arabic digits", () => {
    expect(westernDigits("٣٤ - ١٢٠")).toBe("34 - 120");
  });
});

describe("parseVerseHeading", () => {
  it("reads headings that name the surah's number", () => {
    const range = { style: "surah-range", surah: 4, from: 34, to: 34 };
    expect(parseVerseHeading("[سورة النساء (٤) : آية ٣٤]")).toEqual(range);
    expect(parseVerseHeading("[سورة النساء (٤) : الآيات ٣٤ إلى ٣٦]")).toEqual({ ...range, to: 36 });
    expect(
      parseVerseHeading("القول في تأويل قوله تعالى: [سورة النساء (٤) : الآيات ٣٤ الى ٣٥]"),
    ).toEqual({ ...range, to: 35 });
  });

  it("reads headings that name the verse in words", () => {
    const cases: [string, number, number][] = [
      ["الآية (٣٤)", 34, 34],
      ["الآية [١١]", 11, 11],
      ["(الآية: ٤٧)", 47, 47],
      ["الآية: (٥)", 5, 5],
      ["الآيتان (٨، ٩)", 8, 9],
      ["الآية (١٦) و (١٧)", 16, 17],
      ["(الآيات: ١ - ٣)", 1, 3],
      ["الآية (٦) نص تجريبي", 6, 6],
      ["٢ - الآية الثانية: نص تجريبي", 2, 2],
    ];
    for (const [title, from, to] of cases) {
      expect(parseVerseHeading(title), title).toEqual({ style: "range", from, to });
    }
  });

  it("reads headings that are only a number", () => {
    expect(parseVerseHeading("٣٤")).toEqual({ style: "number", from: 34, to: 34 });
    expect(parseVerseHeading("الآية: ١٣٠")).toEqual({ style: "number", from: 130, to: 130 });
    expect(parseVerseHeading("٣٥ - ٣٧")).toEqual({ style: "number", from: 35, to: 37 });
  });

  it("reads headings that quote the verse, with the number if there is one", () => {
    expect(parseVerseHeading("قوله تعالى: ﴿نص تجريبي﴾")).toMatchObject({
      style: "quote",
      from: null,
    });
    expect(parseVerseHeading("قوله جل وعز: ﴿نص (٢٩)﴾")).toMatchObject({ from: 29, to: 29 });
    expect(parseVerseHeading("قال الله ﷿: (نص (٢٩) تتمة)")).toMatchObject({ from: 29, to: 30 });
  });

  it("leaves other headings alone", () => {
    for (const title of ["مقدمة", "من فوائد الآية الكريمة", "الفائدة الأولى", "تنبيه:"]) {
      expect(parseVerseHeading(title), title).toBeNull();
    }
  });
});

describe("SurahNames", () => {
  it("reads the ways books name a surah", () => {
    const cases: [string, number][] = [
      ["النساء", 4],
      ["٤ - سورة النساء", 4],
      ["(سورة البقرة)", 2],
      ["تفسير سورة آل عمران", 3],
      ["ومن سورة آل عمران , وهي مدنية", 3],
      ["سورة فاتحة الكتاب", 1],
      ["سورة محمد صلى الله عليه وسلم", 47],
      ["سورة بني إسرائيل", 17],
    ];
    for (const [title, surah] of cases) {
      expect(names.ofHeading(title, true), title).toEqual([surah]);
    }
    expect(names.ofHeading("تفسير سورتي المعوذتين", true)).toEqual([113, 114]);
  });

  it("takes a name alone as a surah only at the top level", () => {
    expect(names.ofHeading("محمد", false)).toEqual([]);
    expect(names.ofHeading("سورة محمد", false)).toEqual([47]);
    expect(names.ofHeading("المقدمة", true)).toEqual([]);
  });

  it("finds the one surah a book's title names", () => {
    expect(names.ofBookTitle("تفسير العثيمين: لقمان")).toBe(31);
    expect(names.ofBookTitle("تفسير سورة الفاتحة لابن فلان")).toBe(1);
    expect(names.ofBookTitle("تفسير العثيمين: الفاتحة والبقرة")).toBeNull();
    expect(names.ofBookTitle("كتاب تجريبي")).toBeNull();
  });
});

describe("quotes", () => {
  // Placeholder sentences in Uthmani spelling, not verses.
  const verses = [
    "هَٰذَا نَصٌّ لِلتَّجۡرِبَةِ فَقَطۡ",
    "وَهَٰذِهِ ٱلۡكَلِمَٰتُ لَيۡسَتۡ مِنۡ كِتَابٍ",
    "هَٰذَا نَصٌّ لِلتَّجۡرِبَةِ مَرَّةً أُخۡرَىٰ",
  ];

  it("matches a quote in plain spelling to its verse", () => {
    expect(versesOfQuote("﴿هذه الكلمات ليست من كتاب﴾", verses)).toEqual([2]);
  });

  it("matches a quote that runs over more than one verse", () => {
    expect(versesOfQuote("هذا نص للتجربة فقط وهذه الكلمات ليست", verses)).toEqual([1]);
    expect(quoteParts("هذا نص للتجربة فقط (1) وهذه الكلمات ليست")).toHaveLength(2);
  });

  it("gives every verse a quote fits, and none for a short quote", () => {
    expect(versesOfQuote("هذا نص للتجربة", verses)).toEqual([1, 3]);
    expect(versesOfQuote("نص", verses)).toEqual([]);
    expect(isPartOfVerse("فقط", verses[0])).toBe(true);
    expect(isPartOfVerse("فقط", verses[1])).toBe(false);
  });
});
