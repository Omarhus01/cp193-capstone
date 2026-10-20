import { describe, expect, it } from "vitest";
import { isProtectedPath, loginRedirectPath, safeNextPath } from "./paths";

describe("isProtectedPath", () => {
  it("protects surah pages in every locale", () => {
    expect(isProtectedPath("/en/surah/1")).toBe(true);
    expect(isProtectedPath("/ko/surah/114")).toBe(true);
    expect(isProtectedPath("/en/surah")).toBe(true);
  });

  it("leaves public pages open", () => {
    expect(isProtectedPath("/en")).toBe(false);
    expect(isProtectedPath("/ko/login")).toBe(false);
    expect(isProtectedPath("/en/signup")).toBe(false);
  });

  it("matches whole path segments only", () => {
    expect(isProtectedPath("/en/surahs")).toBe(false);
  });
});

describe("loginRedirectPath", () => {
  it("points to the login page with the encoded return path", () => {
    expect(loginRedirectPath("en", "/en/surah/1")).toBe("/en/login?next=%2Fen%2Fsurah%2F1");
    expect(loginRedirectPath("ko", "/ko/surah/2?x=1")).toBe(
      "/ko/login?next=%2Fko%2Fsurah%2F2%3Fx%3D1",
    );
  });
});

describe("safeNextPath", () => {
  it("keeps paths on this site under a known locale", () => {
    expect(safeNextPath("/en/surah/1", "en")).toBe("/en/surah/1");
    expect(safeNextPath("/ko/surah/2?x=1", "en")).toBe("/ko/surah/2?x=1");
  });

  it("falls back to the locale home page for anything else", () => {
    expect(safeNextPath(null, "ko")).toBe("/ko");
    expect(safeNextPath("", "en")).toBe("/en");
    expect(safeNextPath("surah/1", "en")).toBe("/en");
    expect(safeNextPath("/fr/surah/1", "en")).toBe("/en");
  });

  it("rejects links that would leave the site", () => {
    expect(safeNextPath("https://evil.example", "en")).toBe("/en");
    expect(safeNextPath("//evil.example", "en")).toBe("/en");
    expect(safeNextPath("/\\evil.example", "en")).toBe("/en");
    expect(safeNextPath("/en/\\evil.example", "en")).toBe("/en");
    expect(safeNextPath("/\t/evil.example", "en")).toBe("/en");
  });
});
