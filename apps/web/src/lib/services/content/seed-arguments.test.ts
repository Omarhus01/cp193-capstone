import { describe, expect, it } from "vitest";
import { parseSurahArguments } from "./seed-arguments";

const available = [1, 2, 4, 114];

describe("parseSurahArguments", () => {
  it("seeds everything when no surah is given", () => {
    expect(parseSurahArguments([], available)).toEqual({ ok: true, surahs: null });
  });

  it("returns the surahs asked for, sorted, each once", () => {
    expect(parseSurahArguments(["2", "4"], available)).toEqual({ ok: true, surahs: [2, 4] });
    expect(parseSurahArguments(["114", "2", "2"], available)).toEqual({
      ok: true,
      surahs: [2, 114],
    });
  });

  it.each(["0", "115", "abc", "2.5", "-1", "", "1e2"])("refuses %j", (arg) => {
    const result = parseSurahArguments([arg], available);
    expect(result).toEqual({ ok: false, error: `"${arg}" isn't a surah number (1 to 114)` });
  });

  it("refuses a surah that isn't in content/", () => {
    expect(parseSurahArguments(["2", "3"], available)).toEqual({
      ok: false,
      error: "surah 3 isn't in content/surahs/",
    });
  });
});
