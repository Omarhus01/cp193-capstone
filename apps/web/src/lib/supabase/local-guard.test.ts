import { describe, expect, it } from "vitest";
import { assertLocalServer, assertLocalSupabaseUrl, isLocalUrl } from "./local-guard";

describe("isLocalUrl", () => {
  it("accepts only this machine", () => {
    expect(isLocalUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalUrl("http://localhost:3001")).toBe(true);
    expect(isLocalUrl("https://localhost")).toBe(true);
  });

  it("refuses hosted projects, look-alikes and garbage", () => {
    expect(isLocalUrl("https://abcdefgh.supabase.co")).toBe(false);
    expect(isLocalUrl("https://localhost.example.com")).toBe(false);
    expect(isLocalUrl("http://127.0.0.1.example.com")).toBe(false);
    expect(isLocalUrl("http://evil.com/?localhost")).toBe(false);
    expect(isLocalUrl("http://user@example.com:80/127.0.0.1")).toBe(false);
    expect(isLocalUrl("ftp://localhost")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
    expect(isLocalUrl("")).toBe(false);
    expect(isLocalUrl(undefined)).toBe(false);
  });
});

describe("assertLocalSupabaseUrl", () => {
  it("lets a local Supabase through", () => {
    expect(() => assertLocalSupabaseUrl("http://127.0.0.1:54321", "seed fixtures")).not.toThrow();
  });

  it("refuses a hosted project before anything is written", () => {
    expect(() => assertLocalSupabaseUrl("https://abcdefgh.supabase.co", "seed fixtures")).toThrow(
      /Refusing to seed fixtures/,
    );
    expect(() => assertLocalSupabaseUrl(undefined, "create a test user")).toThrow(/Refusing/);
  });
});

describe("assertLocalServer", () => {
  const answering = (report: unknown) => async () => new Response(JSON.stringify(report));

  it("lets a local server that uses a local Supabase through", async () => {
    await expect(
      assertLocalServer(
        "http://localhost:3001",
        "sign up",
        answering({ ok: true, supabase: "local" }),
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a local server that talks to a hosted Supabase (an old dev server on the port)", async () => {
    await expect(
      assertLocalServer(
        "http://localhost:3000",
        "sign up",
        answering({ ok: true, supabase: "remote" }),
      ),
    ).rejects.toThrow(/talks to a hosted Supabase/);
  });

  it("refuses a deployed site without asking it anything", async () => {
    let asked = false;
    const fetchHealth = async () => {
      asked = true;
      return new Response("{}");
    };
    await expect(
      assertLocalServer("https://quran.example.vercel.app", "sign up", fetchHealth),
    ).rejects.toThrow(/isn't local/);
    expect(asked).toBe(false);
  });

  it("refuses a server that can't say which Supabase it uses", async () => {
    const failing = async () => {
      throw new Error("connection refused");
    };
    await expect(assertLocalServer("http://localhost:3001", "sign up", failing)).rejects.toThrow(
      /couldn't ask/,
    );
    await expect(
      assertLocalServer("http://localhost:3001", "sign up", async () => new Response("<html>")),
    ).rejects.toThrow(/couldn't ask/);
    await expect(
      assertLocalServer("http://localhost:3001", "sign up", answering({ ok: true })),
    ).rejects.toThrow(/hosted Supabase/);
  });
});
