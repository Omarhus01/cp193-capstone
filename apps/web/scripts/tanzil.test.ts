// Reading Tanzil's metadata. The XML here is made up in Tanzil's format; only its shape matters.
import { describe, expect, it } from "vitest";
import { newSurahFile, readPageStarts } from "./tanzil";

/** quran-data.xml with 114 surahs of 10 verses and the given page starts ("surah:ayah"). */
function metadataXml(pageStarts: string[]): string {
  const suras = Array.from(
    { length: 114 },
    (_, i) =>
      `<sura index="${i + 1}" ayas="10" name="اختبار" tname="Test-${i + 1}" type="Meccan" />`,
  );
  const pages = pageStarts.map((ref, i) => {
    const [sura, aya] = ref.split(":");
    return `<page index="${i + 1}" sura="${sura}" aya="${aya}" />`;
  });
  return `<quran><suras>${suras.join("\n")}</suras><pages>${pages.join("\n")}</pages></quran>`;
}

/** 604 page starts: every verse of surahs 1 to 60, then verse 1 of surahs 61 to 64. */
function validStarts(): string[] {
  const starts: string[] = [];
  for (let surah = 1; surah <= 60; surah++) {
    for (let ayah = 1; ayah <= 10; ayah++) {
      starts.push(`${surah}:${ayah}`);
    }
  }
  return [...starts, "61:1", "62:1", "63:1", "64:1"];
}

describe("readPageStarts", () => {
  it("reads the first verse of each of the 604 pages", () => {
    const pages = readPageStarts(metadataXml(validStarts()));
    expect(pages).toHaveLength(604);
    expect(pages[0]).toEqual({ page: 1, surah: 1, ayah: 1 });
    expect(pages[10]).toEqual({ page: 11, surah: 2, ayah: 1 });
  });

  it("refuses a list that isn't 604 pages long", () => {
    expect(() => readPageStarts(metadataXml(validStarts().slice(0, 603)))).toThrow(
      "lists 603 pages, not 604",
    );
  });

  it("refuses a page that starts at no verse, or before the page before it", () => {
    const pastTheEnd = validStarts();
    pastTheEnd[20] = "4:11";
    expect(() => readPageStarts(metadataXml(pastTheEnd))).toThrow("page 21 is missing");
    const backwards = validStarts();
    [backwards[20], backwards[21]] = [backwards[21], backwards[20]];
    expect(() => readPageStarts(metadataXml(backwards))).toThrow("page 22 starts before page 21");
  });

  it("refuses a first page that doesn't start at 1:1", () => {
    const late = [...validStarts().slice(1), "65:1"];
    expect(() => readPageStarts(metadataXml(late))).toThrow("page 1 doesn't start at 1:1");
  });
});

describe("newSurahFile", () => {
  it("names a new surah with Tanzil's transliteration and leaves the Korean name empty", () => {
    expect(newSurahFile("Al-Baqara")).toEqual({
      $schema: "../../schema/surah.schema.json",
      names: { en: "Al-Baqara", ko: null },
    });
  });

  it("leaves the English name empty when Tanzil has none", () => {
    expect(newSurahFile(undefined).names.en).toBeNull();
    expect(newSurahFile(" ").names.en).toBeNull();
  });
});
