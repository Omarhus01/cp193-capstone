import { describe, expect, it } from "vitest";
import {
  authLinkNextPath,
  isProtectedPath,
  loginRedirectPath,
  logoutRedirectPath,
  safeNextPath,
} from "./paths";

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

describe("authLinkNextPath", () => {
  const params = (query = "") => new URLSearchParams(query);

  it("returns the current page, query string included", () => {
    expect(authLinkNextPath("/en", params(), "en")).toBe("/en");
    expect(authLinkNextPath("/ko/surah/2", params("x=1"), "ko")).toBe("/ko/surah/2?x=1");
  });

  it("keeps the existing next on the login and signup pages", () => {
    expect(authLinkNextPath("/en/login", params("next=%2Fen%2Fsurah%2F3"), "en")).toBe(
      "/en/surah/3",
    );
    expect(authLinkNextPath("/ko/signup", params(), "ko")).toBe("/ko");
  });

  it("drops an unsafe next on the login page", () => {
    expect(authLinkNextPath("/en/login", params("next=%2F%2Fevil.example"), "en")).toBe("/en");
  });
});

describe("logoutRedirectPath", () => {
  it("stays on a public page", () => {
    expect(logoutRedirectPath("/ko", "ko")).toBe("/ko");
    expect(logoutRedirectPath("/en/login?next=%2Fen", "en")).toBe("/en/login?next=%2Fen");
  });

  it("goes home from a protected page", () => {
    expect(logoutRedirectPath("/en/surah/1", "en")).toBe("/en");
    expect(logoutRedirectPath("/ko/surah/2?x=1", "ko")).toBe("/ko");
  });

  it("goes home when the path is missing or unsafe", () => {
    expect(logoutRedirectPath(null, "en")).toBe("/en");
    expect(logoutRedirectPath("https://evil.example", "ko")).toBe("/ko");
  });
});
