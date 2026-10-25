import { describe, expect, it } from "vitest";
import { pickText } from "./localized";

describe("pickText", () => {
  it("shows English on English pages, with nothing under it", () => {
    expect(pickText({ en: "[en]", ko: "[ko]" }, "en")).toEqual({
      primary: "[en]",
      primaryLang: "en",
      english: null,
    });
  });

  it("shows Korean on Korean pages, with the English available under it", () => {
    expect(pickText({ en: "[en]", ko: "[ko]" }, "ko")).toEqual({
      primary: "[ko]",
      primaryLang: "ko",
      english: "[en]",
    });
  });

  it("shows the English on a Korean page when a draft has no Korean yet", () => {
    expect(pickText({ en: "[en]", ko: null }, "ko")).toEqual({
      primary: "[en]",
      primaryLang: "en",
      english: null,
    });
  });

  it("shows nothing when nothing is written", () => {
    expect(pickText({ en: null, ko: null }, "ko").primary).toBeNull();
  });
});
