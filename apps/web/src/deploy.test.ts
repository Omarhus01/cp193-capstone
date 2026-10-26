import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The deployed site (Vercel) holds only public variables: the two Supabase ones, and the optional
// feedback form link (docs/deploy.md, ADR 0017). The service role key bypasses row level security, so it is used only by tooling run by
// the owner (scripts/seed-content.mts) and by local tests, never by the app itself.

const SRC = fileURLToPath(new URL(".", import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) {
      return sourceFiles(file);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : [];
  });
}

describe("the deployed app", () => {
  it("never reads the service role key", () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /SERVICE_ROLE|service_role|sb_secret_/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it("reads only the public variables", () => {
    const variables = new Set(
      sourceFiles(SRC).flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]),
      ),
    );
    expect([...variables].sort()).toEqual([
      "NEXT_PUBLIC_FEEDBACK_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });
});

describe("the keep-alive workflow (.github/workflows/keep-alive.yml)", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/keep-alive.yml", import.meta.url),
    "utf8",
  );

  it("runs every day and has a manual run button", () => {
    expect(workflow).toMatch(/^on:\n {2}schedule:\n {4}- cron: "[^"]+"\n {2}workflow_dispatch:/m);
  });

  it("uses only the public URL and key, and no other permissions", () => {
    const secrets = new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    expect([...secrets].sort()).toEqual(["SUPABASE_ANON_KEY", "SUPABASE_URL"]);
    expect(workflow).not.toMatch(/service_role|SERVICE_ROLE|sb_secret_/i);
    expect(workflow).toMatch(/^permissions: \{\}$/m);
  });

  it("makes one read-only request to a public table", () => {
    expect(workflow.match(/\bcurl\b/g)).toHaveLength(1);
    // A GET: no other method and no request body.
    expect(workflow).not.toMatch(/\s(-X|--request|-d|--data[\w-]*|-F|--form)\s/);
    expect(workflow).toContain('/rest/v1/surah?select=number&limit=1"');
  });
});
