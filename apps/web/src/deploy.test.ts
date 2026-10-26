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
