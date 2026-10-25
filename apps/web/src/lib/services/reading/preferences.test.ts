import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFERENCE_COOKIES,
  parsePreferences,
  preferenceCookie,
} from "./preferences";

const cookies = (values: Record<string, string>) => (name: string) => values[name];

describe("parsePreferences", () => {
  it("starts with English hidden and pronunciation shown", () => {
    expect(parsePreferences(cookies({}))).toEqual({ showEnglish: false, showPronunciation: true });
    expect(DEFAULT_PREFERENCES).toEqual({ showEnglish: false, showPronunciation: true });
  });

  it("reads the stored choices", () => {
    expect(
      parsePreferences(
        cookies({
          [PREFERENCE_COOKIES.showEnglish]: "1",
          [PREFERENCE_COOKIES.showPronunciation]: "0",
        }),
      ),
    ).toEqual({ showEnglish: true, showPronunciation: false });
  });

  it("ignores values it doesn't know", () => {
    expect(parsePreferences(cookies({ [PREFERENCE_COOKIES.showEnglish]: "yes" }))).toEqual(
      DEFAULT_PREFERENCES,
    );
  });
});

describe("preferenceCookie", () => {
  it("stores a choice for a year on every path", () => {
    expect(preferenceCookie("showEnglish", true)).toBe(
      "qe-show-english=1; Path=/; Max-Age=31536000; SameSite=Lax",
    );
    expect(preferenceCookie("showPronunciation", false)).toMatch(/^qe-show-pronunciation=0;/);
  });

  it("round-trips through parsePreferences", () => {
    const [pair] = preferenceCookie("showEnglish", true).split(";");
    const [name, value] = pair.split("=");
    expect(parsePreferences(cookies({ [name]: value })).showEnglish).toBe(true);
  });
});
