import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const COOKIE = "sb-test-auth-token";

// Stands in for Supabase's getClaims(): like a real token refresh, it writes new session cookies
// through setAll. `refreshedValue: ""` is how Supabase clears a dead session.
const session = vi.hoisted(() => ({ refreshedValue: "refreshed", loggedIn: true }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    { cookies }: { cookies: { setAll: (c: object[], h: Record<string, string>) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        cookies.setAll(
          [{ name: "sb-test-auth-token", value: session.refreshedValue, options: { path: "/" } }],
          { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" },
        );
        return { data: session.loggedIn ? { claims: { sub: "user-1" } } : null };
      },
    },
  }),
}));

const { default: proxy } = await import("./proxy");

function requestFor(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie: `${COOKIE}=expired; other=1` },
  });
}

describe("proxy session refresh", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    session.refreshedValue = "refreshed";
    session.loggedIn = true;
  });

  it("makes refreshed session cookies visible to Server Components", async () => {
    const response = await proxy(requestFor("/en"));

    // Next.js merges cookies set on the proxy response into cookies() for the render, using this
    // header. Without it, Server Components would refresh the expired session a second time.
    expect(response.headers.get("x-middleware-set-cookie")).toContain(`${COOKIE}=refreshed`);
    expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe("en");
  });

  it("sends the refreshed cookies and Supabase's cache headers to the browser", async () => {
    const response = await proxy(requestFor("/ko"));

    expect(response.cookies.get(COOKIE)?.value).toBe("refreshed");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("redirects logged-out users from protected pages and still clears their cookie", async () => {
    session.loggedIn = false;
    session.refreshedValue = "";

    const response = await proxy(requestFor("/ko/surah/2"));

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/ko/login?next=%2Fko%2Fsurah%2F2",
    );
    expect(response.cookies.get(COOKIE)?.value).toBe("");
  });

  it("lets logged-in users through to protected pages", async () => {
    const response = await proxy(requestFor("/en/surah/1"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get(COOKIE)?.value).toBe("refreshed");
  });
});
