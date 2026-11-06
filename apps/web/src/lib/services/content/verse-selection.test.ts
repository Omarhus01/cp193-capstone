import { describe, expect, it } from "vitest";
import { parseVerseSelection } from "./verse-selection";

describe("parseVerseSelection", () => {
  it("reads whole surahs, single verses and ranges", () => {
    expect(parseVerseSelection(["1", "4:34", "2:5-7"])).toEqual([
      { surah: 1, ayahs: "all" },
      { surah: 4, ayahs: [34] },
      { surah: 2, ayahs: [5, 6, 7] },
    ]);
  });

  it("combines arguments for the same surah, in verse order", () => {
    expect(parseVerseSelection(["4:40", "4:34-35"])).toEqual([{ surah: 4, ayahs: [34, 35, 40] }]);
  });

  it("rejects malformed arguments", () => {
    for (const arg of ["", "x", "0", "115", "4:", "4:0", "4:36-34", "4:34-", "4:34:2"]) {
      expect(() => parseVerseSelection([arg]), arg).toThrow();
    }
  });

  it("rejects a verse listed twice", () => {
    expect(() => parseVerseSelection(["4:34", "4:33-35"])).toThrow("Verse 4:34 is listed twice");
  });

  it("rejects a surah listed whole and by verses, or whole twice", () => {
    expect(() => parseVerseSelection(["4", "4:34"])).toThrow("listed whole and by verses");
    expect(() => parseVerseSelection(["4:34", "4"])).toThrow("listed more than once");
    expect(() => parseVerseSelection(["4", "4"])).toThrow("listed more than once");
  });
});
