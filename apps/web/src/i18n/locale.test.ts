import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ko from "../../messages/ko.json";
import { findBannedTerms } from "@/lib/services/terminology";
import { isLocale, stripLocale } from "./locale";

describe("isLocale", () => {
  it("accepts the supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ko")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("EN")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe("stripLocale", () => {
  it("splits the locale from the rest of the path", () => {
    expect(stripLocale("/ko/surah/2")).toEqual({ locale: "ko", path: "/surah/2" });
    expect(stripLocale("/en/login")).toEqual({ locale: "en", path: "/login" });
  });

  it("returns the root path for a bare locale", () => {
    expect(stripLocale("/en")).toEqual({ locale: "en", path: "/" });
  });

  it("returns a null locale when the path has none", () => {
    expect(stripLocale("/surah/2")).toEqual({ locale: null, path: "/surah/2" });
    expect(stripLocale("/")).toEqual({ locale: null, path: "/" });
  });
});

/** Lists every leaf key, such as "auth.errors.invalidEmail". */
function messageKeys(messages: object, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? messageKeys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("message files", () => {
  it("have the same keys in English and Korean", () => {
    expect(messageKeys(ko).sort()).toEqual(messageKeys(en).sort());
  });

  it("never use 하나님, or God as a name", () => {
    expect(findBannedTerms(JSON.stringify(ko))).toEqual([]);
    expect(findBannedTerms(JSON.stringify(en))).toEqual([]);
  });
});
