import { describe, expect, it, vi } from "vitest";

// auth.ts reads cookies through the server client; only the pure mapping is tested here.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));

const { testerFromRpc } = await import("./auth");

describe("testerFromRpc", () => {
  it("is true only when the database says true", () => {
    expect(testerFromRpc({ data: true, error: null })).toBe(true);
    expect(testerFromRpc({ data: false, error: null })).toBe(false);
  });

  it("fails closed: an error or an unexpected answer is not a tester", () => {
    expect(testerFromRpc({ data: true, error: { message: "boom" } })).toBe(false);
    expect(testerFromRpc({ data: null, error: null })).toBe(false);
    expect(testerFromRpc({ data: "true", error: null })).toBe(false);
  });
});
