import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// The test seeds through the same payload builder as scripts/seed-content.mts.
// eslint-disable-next-line no-restricted-imports
import { loadContent } from "@/lib/services/content/load";
// eslint-disable-next-line no-restricted-imports
import { toSeedPayload } from "@/lib/services/content/payload";
// eslint-disable-next-line no-restricted-imports
import { testBundle } from "@/lib/services/content/test-bundle";
import {
  getExplanationsForSpan,
  getPassagesForExplanation,
  getReadingSection,
  getSurahContent,
} from "./content";

// Runs against a local Supabase (npx supabase start) and replaces its content, so it is skipped
// unless SUPABASE_DB_TEST=1 and the URL is local. It never runs against the hosted project.
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY
// (from `npx supabase status -o env`). See content/README.md, "Testing against a local database".
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const enabled =
  process.env.SUPABASE_DB_TEST === "1" && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);

const TABLES = [
  "surah",
  "verse",
  "word",
  "span",
  "source",
  "passage",
  "explanation",
  "explanation_citation",
  "context_link",
  "reading_section",
  "surah_brief",
  "word_meaning",
  "word_meaning_citation",
  "explanation_review",
  "word_meaning_review",
  "surah_brief_review",
];

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(!enabled)("content in the database (local Supabase)", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let user: SupabaseClient;

  async function seed(payload: unknown) {
    const { error } = await service.rpc("seed_content", { payload });
    expect(error).toBeNull();
  }

  async function snapshot(): Promise<Record<string, unknown[]>> {
    const entries = await Promise.all(
      TABLES.map(async (table) => {
        const { data, error } = await service.from(table).select("*");
        expect(error).toBeNull();
        const sorted = (data ?? []).map((row) => JSON.stringify(row)).sort();
        return [table, sorted] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  beforeAll(async () => {
    service = createClient(url, serviceRoleKey, noSession);
    anon = createClient(url, anonKey, noSession);
    user = createClient(url, anonKey, noSession);
    const { error } = await user.auth.signUp({
      email: `content-test-${Date.now()}@example.com`,
      password: "content-test-password",
    });
    expect(error).toBeNull();
    await seed(toSeedPayload(testBundle()));
  });

  afterAll(async () => {
    // Put the real content back.
    if (service) {
      await seed(toSeedPayload(loadContent().bundle));
    }
  });

  it("gives the same database when seeded twice", async () => {
    const before = await snapshot();
    await seed(toSeedPayload(testBundle()));
    expect(await snapshot()).toEqual(before);
  });

  it("deletes rows that left the content", async () => {
    const smaller = testBundle();
    smaller.surahs[0].explanations.pop();
    await seed(toSeedPayload(smaller));
    const { data } = await service.from("explanation").select("id").eq("id", "s1-draft");
    expect(data).toEqual([]);
    await seed(toSeedPayload(testBundle()));
  });

  it("refuses a payload with a missing table, and changes nothing", async () => {
    const before = await snapshot();
    const broken = Object.fromEntries(
      Object.entries(toSeedPayload(testBundle())).filter(([table]) => table !== "explanations"),
    );
    const { error } = await service.rpc("seed_content", { payload: broken });
    expect(error?.message).toContain("payload.explanations");
    expect(await snapshot()).toEqual(before);
  });

  describe("lib/data returns only published content", () => {
    it("getSurahContent", async () => {
      const content = await getSurahContent(1);
      expect(content?.surah.verseCount).toBe(4);
      expect(content?.verses).toHaveLength(4);
      expect(content?.verses[0].words.map((w) => w.position)).toEqual([1, 2, 3, 4]);
      expect(content?.brief).toEqual({ en: "brief (en)", ko: "brief (ko)" });
      expect(content?.wordMeanings.map((m) => m.word)).toEqual([{ surah: 1, ayah: 1, word: 1 }]);
      expect(content?.readingSections.map((s) => s.position)).toEqual([1, 2]);
      expect(await getSurahContent(99)).toBeNull();
    });

    it("getExplanationsForSpan finds overlapping published explanations, in order", async () => {
      const verse3 = await getExplanationsForSpan({
        start: { surah: 1, ayah: 3, word: null },
        end: { surah: 1, ayah: 3, word: null },
      });
      expect(verse3.map((e) => e.id)).toEqual(["s1-reading-2"]);

      const word = await getExplanationsForSpan({
        start: { surah: 1, ayah: 2, word: 3 },
        end: { surah: 1, ayah: 2, word: 3 },
      });
      expect(word.map((e) => e.id)).toEqual(["s1-reading-1", "s1-note"]);
      const note = word.find((e) => e.id === "s1-note");
      expect(note?.passageIds).toEqual(["passage-1"]);
      expect(note?.contextLinks[0].span.start).toEqual({ surah: 2, ayah: 1, word: null });
    });

    it("getReadingSection returns the section with its verses", async () => {
      const section = await getReadingSection(1, 2);
      expect(section?.explanation.id).toBe("s1-reading-2");
      expect(section?.verses.map((v) => v.ayah)).toEqual([3, 4]);
      expect(await getReadingSection(1, 3)).toBeNull();
    });

    it("getPassagesForExplanation returns passages only for a published explanation", async () => {
      const passages = await getPassagesForExplanation("s1-note");
      expect(passages.map((p) => p.id)).toEqual(["passage-1"]);
      expect(passages[0].source.titleEn).toBe("Test source");
      expect(await getPassagesForExplanation("s1-draft")).toEqual([]);
    });
  });

  describe.each([
    ["anon", () => anon],
    ["a logged-in user", () => user],
  ])("as %s", (_, client) => {
    it("can't read drafts, review history or uncited passages", async () => {
      const db = client();
      const drafts = await db.from("explanation").select("id").eq("status", "draft");
      expect(drafts.data).toEqual([]);
      const meanings = await db.from("word_meaning").select("position").eq("position", 2);
      expect(meanings.data).toEqual([]);
      const passage = await db.from("passage").select("id").eq("id", "passage-2");
      expect(passage.data).toEqual([]);
      for (const table of ["explanation_review", "word_meaning_review", "surah_brief_review"]) {
        const { data, error } = await db.from(table).select("*");
        expect(error !== null || data?.length === 0, table).toBe(true);
      }
    });

    it("can read the text and published content", async () => {
      const db = client();
      expect((await db.from("verse").select("ayah").eq("surah", 1)).data).toHaveLength(4);
      expect((await db.from("explanation").select("id")).data).toHaveLength(3);
    });

    it("can't insert, update or delete", async () => {
      const db = client();
      const insert = await db.from("source").insert({
        id: "intruder",
        title_en: "x",
        author: "x",
        type: "tafsir",
      });
      expect(insert.error).not.toBeNull();
      await db.from("explanation").update({ status: "draft" }).eq("id", "s1-note");
      await db.from("verse").delete().eq("surah", 1);
      const { data } = await service.from("explanation").select("status").eq("id", "s1-note");
      expect(data).toEqual([{ status: "published" }]);
      expect((await service.from("verse").select("ayah").eq("surah", 1)).data).toHaveLength(4);
      expect((await service.from("source").select("id").eq("id", "intruder")).data).toEqual([]);
    });

    it("can't run the seed", async () => {
      const { error } = await client().rpc("seed_content", {
        payload: toSeedPayload(testBundle()),
      });
      expect(error).not.toBeNull();
    });
  });
});
