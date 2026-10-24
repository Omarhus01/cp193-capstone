import { describe, expect, it } from "vitest";
import { confirmRedirectUrl, readConfirmParams } from "./confirm";

const read = (query: string) => readConfirmParams(new URLSearchParams(query));

describe("readConfirmParams", () => {
  it("reads a PKCE code from Supabase's default email link", () => {
    expect(read("code=abc123&locale=ko&next=%2Fko%2Fsurah%2F2")).toEqual({
      locale: "ko",
      next: "/ko/surah/2",
      credential: { kind: "code", code: "abc123" },
    });
  });

  it("reads token_hash and type from a custom email template link", () => {
    expect(read("token_hash=hash1&type=email&locale=en").credential).toEqual({
      kind: "otp",
      tokenHash: "hash1",
      type: "email",
    });
  });

  it("prefers the code when both shapes are present", () => {
    expect(read("code=abc&token_hash=hash1&type=signup").credential).toEqual({
      kind: "code",
      code: "abc",
    });
  });

  it("returns no credential when the link is incomplete or the type is unknown", () => {
    expect(read("").credential).toBeNull();
    expect(read("token_hash=hash1").credential).toBeNull();
    expect(read("type=email").credential).toBeNull();
    expect(read("token_hash=hash1&type=bogus").credential).toBeNull();
    expect(read("code=").credential).toBeNull();
  });

  it("falls back to the default locale and its home page", () => {
    expect(read("code=abc&locale=fr")).toMatchObject({ locale: "en", next: "/en" });
    expect(read("code=abc&locale=ko")).toMatchObject({ locale: "ko", next: "/ko" });
  });

  it("rejects next paths that leave the site", () => {
    expect(read("code=abc&locale=en&next=https%3A%2F%2Fevil.example").next).toBe("/en");
    expect(read("code=abc&locale=en&next=%2F%2Fevil.example").next).toBe("/en");
  });
});

describe("confirmRedirectUrl", () => {
  it("points to the confirm route with the locale and next path", () => {
    expect(confirmRedirectUrl("http://localhost:3000", "ko", "/ko/surah/1")).toBe(
      "http://localhost:3000/auth/confirm?locale=ko&next=%2Fko%2Fsurah%2F1",
    );
  });

  it("round-trips through readConfirmParams", () => {
    const url = new URL(confirmRedirectUrl("https://example.vercel.app", "en", "/en/surah/3"));
    url.searchParams.set("code", "abc");
    expect(readConfirmParams(url.searchParams)).toEqual({
      locale: "en",
      next: "/en/surah/3",
      credential: { kind: "code", code: "abc" },
    });
  });
});
