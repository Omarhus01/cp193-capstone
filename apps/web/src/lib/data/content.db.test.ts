import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// The test seeds through the same payload builder as scripts/seed-content.mts.
// eslint-disable-next-line no-restricted-imports
import { loadContent } from "@/lib/services/content/load";
// eslint-disable-next-line no-restricted-imports
import { toSeedPayload } from "@/lib/services/content/payload";
// eslint-disable-next-line no-restricted-imports
import { explanation, testBundle, wordMeaning } from "@/lib/services/content/test-bundle";
import {
  getExplanationsForSpan,
  getPassages,
  getPassagesForExplanation,
  getReadingSection,
  getSurahContent,
  getWordMeaningsByRoot,
} from "./content";

// The cache directives need the Next.js server; here every call goes to the database.
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

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
  "verse_transliteration",
  "verse_transliteration_review",
];

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * The test bundle with its second reading section left as a draft, and a root shared by a word of
 * 1:1 and a word of 2:1, each with a published meaning.
 */
function rootBundle() {
  const bundle = testBundle();
  const [first, second] = bundle.surahs;
  const section = first.explanations.findIndex((e) => e.id === "s1-reading-2");
  first.explanations[section] = explanation(
    "s1-reading-2",
    "reading_section",
    "1:3",
    "1:4",
    "draft",
  );
  first.words.verses[0].words[0].root = "ا ب ت";
  second.words.verses[0].words[0].root = "ا ب ت";
  second.wordMeanings = [wordMeaning("2:1:1")];
  return bundle;
}

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
    await seed(toSeedPayload(rootBundle()));
  });

  afterAll(async () => {
    // Put the real content back.
    if (service) {
      await seed(toSeedPayload(loadContent().bundle));
    }
  });

  it("gives the same database when seeded twice", async () => {
    const before = await snapshot();
    await seed(toSeedPayload(rootBundle()));
    expect(await snapshot()).toEqual(before);
  });

  it("deletes rows that left the content", async () => {
    const smaller = testBundle();
    smaller.surahs[0].explanations.pop();
    await seed(toSeedPayload(smaller));
    const { data } = await service.from("explanation").select("id").eq("id", "s1-draft");
    expect(data).toEqual([]);
    await seed(toSeedPayload(rootBundle()));
  });

  it("refuses a payload with a missing table, and changes nothing", async () => {
    const before = await snapshot();
    const broken = Object.fromEntries(
      Object.entries(toSeedPayload(rootBundle())).filter(([table]) => table !== "explanations"),
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
      expect(content?.verses[0].transliteration).toEqual({
        en: "pronunciation of 1:1 (en)",
        ko: "pronunciation of 1:1 (ko)",
      });
      expect(content?.verses[1].transliteration).toEqual({ en: null, ko: null });
      expect(await getSurahContent(99)).toBeNull();
    });

    it("getSurahContent lists every reading section, with only published explanations", async () => {
      const content = await getSurahContent(1);
      expect(content?.readingSections.map((s) => [s.position, s.explanation?.id ?? null])).toEqual([
        [1, "s1-reading-1"],
        [2, null],
      ]);
      expect(content?.readingSections[1].span.start).toEqual({ surah: 1, ayah: 3, word: null });
    });

    it("getPassages returns cited passages in the order asked, and skips uncited ones", async () => {
      const passages = await getPassages(["passage-2", "passage-1"]);
      expect(passages.map((p) => p.id)).toEqual(["passage-1"]);
      expect(await getPassages([])).toEqual([]);
    });

    it("getWordMeaningsByRoot finds published meanings of words with the root", async () => {
      const meanings = await getWordMeaningsByRoot(["ا ب ت"]);
      expect(meanings.map((m) => m.word)).toEqual([
        { surah: 1, ayah: 1, word: 1 },
        { surah: 2, ayah: 1, word: 1 },
      ]);
      expect(meanings[1]).toMatchObject({ wordAr: "ابت", root: "ا ب ت" });
      expect(meanings[1].verseAr).toContain("ابت");
      expect(await getWordMeaningsByRoot(["missing"])).toEqual([]);
    });

    it("getExplanationsForSpan finds overlapping published explanations, in order", async () => {
      const verse3 = await getExplanationsForSpan({
        start: { surah: 1, ayah: 3, word: null },
        end: { surah: 1, ayah: 3, word: null },
      });
      // Both explanations of 1:3 (a reading section and a verse explanation) are drafts.
      expect(verse3).toEqual([]);

      const word = await getExplanationsForSpan({
        start: { surah: 1, ayah: 2, word: 3 },
        end: { surah: 1, ayah: 2, word: 3 },
      });
      expect(word.map((e) => e.id)).toEqual(["s1-reading-1", "s1-note"]);
      const note = word.find((e) => e.id === "s1-note");
      expect(note?.passageIds).toEqual(["passage-1"]);
      expect(note?.contextLinks[0].span.start).toEqual({ surah: 2, ayah: 1, word: null });
    });

    it("getReadingSection returns a published section with its verses", async () => {
      const section = await getReadingSection(1, 1);
      expect(section?.explanation.id).toBe("s1-reading-1");
      expect(section?.verses.map((v) => v.ayah)).toEqual([1, 2]);
      expect(await getReadingSection(1, 2)).toBeNull();
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
      const transliteration = await db.from("verse_transliteration").select("ayah").eq("ayah", 2);
      expect(transliteration.data).toEqual([]);
      for (const table of [
        "explanation_review",
        "word_meaning_review",
        "surah_brief_review",
        "verse_transliteration_review",
      ]) {
        const { data, error } = await db.from(table).select("*");
        expect(error !== null || data?.length === 0, table).toBe(true);
      }
    });

    it("can read the text, the reading sections and published content", async () => {
      const db = client();
      expect((await db.from("verse").select("ayah").eq("surah", 1)).data).toHaveLength(4);
      expect((await db.from("explanation").select("id")).data).toHaveLength(2);
      expect((await db.from("reading_section").select("position")).data).toHaveLength(2);
      expect((await db.from("verse_transliteration").select("language")).data).toHaveLength(2);
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
        payload: toSeedPayload(rootBundle()),
      });
      expect(error).not.toBeNull();
    });
  });
});
