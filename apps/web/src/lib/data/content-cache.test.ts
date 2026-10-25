import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Drafts must never reach the shared "use cache" entries that every reader gets (ADR 0016). The
// cached path reads as the anon role with no cookies; the tester preview reads with the user's
// session and is never cached. These checks keep the two paths apart in the source, so a future
// change can't quietly cache the preview or give the cache a session. The e2e test "a tester's
// drafts don't reach other readers" checks the same thing against the running site.

const source = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

/** Each exported function of a module, with its body. */
function exportedFunctions(code: string): { name: string; body: string }[] {
  const starts = [...code.matchAll(/^export async function (\w+)/gm)];
  return starts.map((match, i) => ({
    name: match[1],
    body: code.slice(match.index, starts[i + 1]?.index ?? code.length),
  }));
}

describe("the cached content path (lib/data/content.ts)", () => {
  const code = source("./content.ts");

  it("never reads cookies or a session", () => {
    expect(code).not.toMatch(/@\/lib\/supabase\/server/);
    expect(code).not.toMatch(/next\/headers/);
  });

  it("caches every exported function and reads it as the anon role", () => {
    const functions = exportedFunctions(code);
    expect(functions.length).toBeGreaterThan(0);
    for (const { name, body } of functions) {
      expect(body, name).toMatch(/^\s*"use cache";/m);
      expect(body, name).toContain("createPublicClient()");
    }
  });

  it("asks the shared queries for published content only", () => {
    expect(code).not.toContain('"preview"');
  });
});

describe("the tester preview path (lib/data/content-preview.ts)", () => {
  const code = source("./content-preview.ts");

  it("is never cached", () => {
    expect(code).not.toMatch(/^\s*["']use cache/m);
    expect(code).not.toMatch(/cacheLife|cacheTag/);
  });

  it("reads with the user's session", () => {
    expect(code).toMatch(/from "@\/lib\/supabase\/server"/);
    expect(code).not.toMatch(/createPublicClient/);
  });
});

describe("the shared queries (lib/data/content-queries.ts)", () => {
  const code = source("./content-queries.ts");

  it("neither cache nor choose a client: the caller decides both", () => {
    expect(code).not.toMatch(/^\s*["']use cache/m);
    expect(code).not.toMatch(/@\/lib\/supabase\//);
  });
});
