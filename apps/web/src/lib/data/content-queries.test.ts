import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { querySurahContent } from "./content-queries";

/**
 * A stand-in for the Supabase client that records each query's filters and answers with empty
 * results (and surah 1 for the surah row).
 */
function recordingClient() {
  const filters: string[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        order: () => builder,
        in: () => builder,
        lte: () => builder,
        gte: () => builder,
        eq(column: string, value: unknown) {
          filters.push(`${table}.${column}=${String(value)}`);
          return builder;
        },
        maybeSingle: () => builder,
        then(resolve: (result: { data: unknown; error: null }) => void) {
          const data =
            table === "surah"
              ? {
                  number: 1,
                  name_ar: "اختبار",
                  name_en: null,
                  name_ko: null,
                  revelation_place: "meccan",
                  verse_count: 1,
                  basmala_ar: null,
                }
              : table === "surah_brief"
                ? null
                : [];
          resolve({ data, error: null });
        },
      };
      return builder;
    },
  };
  return { db: client as unknown as SupabaseClient, filters };
}

const statusFilters = (filters: string[]) => filters.filter((f) => f.includes("status="));

describe("querySurahContent", () => {
  it("filters every query on published for the shared, cached path", async () => {
    const { db, filters } = recordingClient();
    await querySurahContent(db, 1, "published");
    expect(statusFilters(filters).sort()).toEqual([
      "explanation.status=published",
      "surah_brief.status=published",
      "verse.verse_transliteration.status=published",
      "word_meaning.status=published",
    ]);
  });

  it("leaves the statuses to row level security on the tester preview path", async () => {
    const { db, filters } = recordingClient();
    await querySurahContent(db, 1, "preview");
    expect(statusFilters(filters)).toEqual([]);
    // The other filters are the same on both paths.
    expect(filters).toContain("explanation.kind=reading_section");
  });
});
