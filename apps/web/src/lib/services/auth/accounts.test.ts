import { beforeEach, describe, expect, it, vi } from "vitest";

const authData = vi.hoisted(() => ({
  getCurrentUserId: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOutThisBrowser: vi.fn(),
  confirmEmail: vi.fn(),
}));
vi.mock("@/lib/data/auth", () => authData);

const { createAccount, logInWithPassword } = await import("./accounts");

const credentials = { email: "user@example.com", password: "password123" };

describe("logInWithPassword", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when the login works", async () => {
    authData.signInWithPassword.mockResolvedValue({ ok: true });
    expect(await logInWithPassword(credentials)).toBeNull();
  });

  it("asks unconfirmed users to confirm their email", async () => {
    authData.signInWithPassword.mockResolvedValue({ ok: false, code: "email_not_confirmed" });
    expect(await logInWithPassword(credentials)).toBe("emailNotConfirmed");
  });

  it("reports any other failure as invalid credentials", async () => {
    authData.signInWithPassword.mockResolvedValue({ ok: false, code: "invalid_credentials" });
    expect(await logInWithPassword(credentials)).toBe("invalidCredentials");
    authData.signInWithPassword.mockResolvedValue({ ok: false, code: undefined });
    expect(await logInWithPassword(credentials)).toBe("invalidCredentials");
  });
});

describe("createAccount", () => {
  beforeEach(() => vi.resetAllMocks());

  it("saves the language and sends the confirmation link back to the confirm route", async () => {
    authData.signUp.mockResolvedValue({ ok: true, loggedIn: false });
    const result = await createAccount({
      credentials,
      locale: "ko",
      origin: "https://example.com",
      next: "/ko/surah/1",
    });

    expect(result).toEqual({ error: null, loggedIn: false });
    const { languagePref, emailRedirectTo } = authData.signUp.mock.calls[0][0];
    expect(languagePref).toBe("ko");
    const url = new URL(emailRedirectTo);
    expect(url.origin + url.pathname).toBe("https://example.com/auth/confirm");
    expect(url.searchParams.get("next")).toBe("/ko/surah/1");
  });

  it("reports a failed signup", async () => {
    authData.signUp.mockResolvedValue({ ok: false });
    const result = await createAccount({
      credentials,
      locale: "en",
      origin: "https://example.com",
      next: "/en",
    });
    expect(result).toEqual({ error: "signupFailed" });
  });
});
