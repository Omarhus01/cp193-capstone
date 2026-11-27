import { describe, expect, it } from "vitest";
import type { SurahLink } from "./surah-list";
import { adjacentSurahs, filterSurahs, normalizeForSearch } from "./surah-search";

const link = (
  number: number,
  nameAr: string,
  nameEn: string | null,
  nameKo: string | null = null,
): SurahLink => ({ number, name: nameEn ?? nameAr, nameAr, nameEn, nameKo, verses: null });

// Names as Tanzil spells them; the Korean names are made up for the test.
const LINKS = [
  link(1, "الفاتحة", "Al-Fatiha", "[테스트 하나]"),
  link(2, "البقرة", "Al-Baqara"),
  link(3, "آل عمران", "Aal-i-Imraan"),
  link(10, "يونس", "Yunus"),
  link(12, "يوسف", "Yusuf"),
  link(21, "الأنبياء", "Al-Anbiyaa"),
  link(100, "العاديات", "Al-Aadiyaat"),
  link(114, "الناس", "An-Naas", "[테스트 둘]"),
];

const numbers = (links: SurahLink[]) => links.map((l) => l.number);

describe("normalizeForSearch", () => {
  it("drops case, accents, hyphens, spaces and the marks of transliterations", () => {
    expect(normalizeForSearch("Al-Fātiḥa")).toBe("alfatiha");
    expect(normalizeForSearch("Āl ʿImrān")).toBe("alimran");
  });

  it("writes doubled Latin letters once", () => {
    expect(normalizeForSearch("Aal-i-Imraan")).toBe("alimran");
  });

  it("drops Arabic vowel marks and the tatweel, and makes every alif plain", () => {
    expect(normalizeForSearch("ٱلْفَاتِحَةِ")).toBe("الفاتحة");
    expect(normalizeForSearch("آل عمران")).toBe("العمران");
    expect(normalizeForSearch("الأنبيـاء")).toBe("الانبياء");
  });

  it("reads Arabic-Indic digits as 0–9", () => {
    expect(normalizeForSearch("١١٤")).toBe("114");
  });

  it("keeps Korean as it is", () => {
    expect(normalizeForSearch("[테스트 하나]")).toBe("[테스트하나]");
  });
});

describe("filterSurahs", () => {
  it("finds every surah when the query is empty", () => {
    expect(numbers(filterSurahs(LINKS, "  "))).toEqual(numbers(LINKS));
  });

  it("finds a number, then the numbers that start with it", () => {
    expect(numbers(filterSurahs(LINKS, "1"))).toEqual([1, 10, 12, 100, 114]);
    expect(numbers(filterSurahs(LINKS, "11"))).toEqual([114]);
    expect(numbers(filterSurahs(LINKS, "12"))).toEqual([12]);
  });

  it("finds a number written in Arabic-Indic digits", () => {
    expect(numbers(filterSurahs(LINKS, "٢"))).toEqual([2, 21]);
  });

  it("finds an English name without its accents, hyphen or article", () => {
    expect(numbers(filterSurahs(LINKS, "baqara"))).toEqual([2]);
    expect(numbers(filterSurahs(LINKS, "Fātiḥa"))).toEqual([1]);
    expect(numbers(filterSurahs(LINKS, "imran"))).toEqual([3]);
    expect(numbers(filterSurahs(LINKS, "YU"))).toEqual([10, 12]);
  });

  it("finds an Arabic name typed without vowel marks", () => {
    expect(numbers(filterSurahs(LINKS, "بقرة"))).toEqual([2]);
    expect(numbers(filterSurahs(LINKS, "ٱلنَّاس"))).toEqual([114]);
  });

  it("finds a Korean name", () => {
    expect(numbers(filterSurahs(LINKS, "하나"))).toEqual([1]);
    expect(numbers(filterSurahs(LINKS, "테스트"))).toEqual([1, 114]);
  });

  it("finds nothing when no name or number matches", () => {
    expect(filterSurahs(LINKS, "zzz")).toEqual([]);
    expect(filterSurahs(LINKS, "999")).toEqual([]);
  });
});

describe("adjacentSurahs", () => {
  it("has no previous surah for the first, and no next one for the last", () => {
    expect(adjacentSurahs(LINKS, 1)).toEqual({ previous: null, next: LINKS[1] });
    expect(adjacentSurahs(LINKS, 114)).toEqual({ previous: LINKS[6], next: null });
  });

  it("gives both neighbours in the middle", () => {
    expect(adjacentSurahs(LINKS, 2)).toEqual({ previous: LINKS[0], next: LINKS[2] });
  });

  it("skips surahs the list doesn't hold", () => {
    expect(adjacentSurahs(LINKS, 3)).toEqual({ previous: LINKS[1], next: LINKS[3] });
    expect(adjacentSurahs(LINKS, 3).next?.number).toBe(10);
  });

  it("has no neighbours for a surah the list doesn't hold", () => {
    expect(adjacentSurahs(LINKS, 50)).toEqual({ previous: null, next: null });
  });
});
