import { describe, expect, it } from "vitest";
import { parseSurahNumber } from "./surah";

describe("parseSurahNumber", () => {
  it("accepts 1 to 114", () => {
    expect(parseSurahNumber("1")).toBe(1);
    expect(parseSurahNumber("114")).toBe(114);
  });

  it("rejects numbers out of range and non-numbers", () => {
    expect(parseSurahNumber("0")).toBeNull();
    expect(parseSurahNumber("115")).toBeNull();
    expect(parseSurahNumber("-1")).toBeNull();
    expect(parseSurahNumber("2.5")).toBeNull();
    expect(parseSurahNumber("abc")).toBeNull();
    expect(parseSurahNumber("")).toBeNull();
  });
});
