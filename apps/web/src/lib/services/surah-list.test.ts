import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedSurah } from "@/lib/domain/content";

const contentData = vi.hoisted(() => ({ getPublishedSurahs: vi.fn() }));
vi.mock("@/lib/data/content", () => contentData);

const { loadSurahLinks, surahLinks, verseRanges } = await import("./surah-list");

const surah = (overrides: Partial<PublishedSurah> = {}): PublishedSurah => ({
  number: 4,
  nameAr: "النساء",
  nameEn: "[surah 4 en]",
  nameKo: "[surah 4 ko]",
  verseCount: 176,
  ayahs: [34],
  ...overrides,
});

describe("verseRanges", () => {
  it("is null for a surah that holds every verse", () => {
    expect(verseRanges(1, [1, 2, 3, 4, 5, 6, 7], 7)).toBeNull();
  });

  it("is null for a surah that holds no verse", () => {
    expect(verseRanges(4, [], 176)).toBeNull();
  });

  it("names a single verse", () => {
    expect(verseRanges(4, [34], 176)).toBe("4:34");
  });

  it("joins neighbouring verses into a range", () => {
    expect(verseRanges(4, [34, 35, 36], 176)).toBe("4:34–36");
  });

  it("lists separate ranges in order, whatever the input order", () => {
    expect(verseRanges(4, [60, 34, 59, 34], 176)).toBe("4:34, 4:59–60");
  });
});

describe("surahLinks", () => {
  it("names each surah in the page's language, with the verses it holds", () => {
    expect(surahLinks([surah()], "en")).toEqual([
      { number: 4, name: "[surah 4 en]", verses: "4:34" },
    ]);
    expect(surahLinks([surah()], "ko")[0].name).toBe("[surah 4 ko]");
  });

  it("falls back to the English name, then the Arabic", () => {
    expect(surahLinks([surah({ nameKo: null })], "ko")[0].name).toBe("[surah 4 en]");
    expect(surahLinks([surah({ nameEn: null, nameKo: null })], "en")[0].name).toBe("النساء");
  });

  it("gives a complete surah no verses", () => {
    const fatiha = surah({ number: 1, verseCount: 7, ayahs: [1, 2, 3, 4, 5, 6, 7] });
    expect(surahLinks([fatiha], "en")[0].verses).toBeNull();
  });
});

describe("loadSurahLinks", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists the published surahs", async () => {
    contentData.getPublishedSurahs.mockResolvedValue([surah()]);
    expect(await loadSurahLinks("en")).toEqual([
      { number: 4, name: "[surah 4 en]", verses: "4:34" },
    ]);
  });

  it("is empty, and logs, when the surahs can't be loaded", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    contentData.getPublishedSurahs.mockRejectedValue(new Error("offline"));
    expect(await loadSurahLinks("en")).toEqual([]);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
