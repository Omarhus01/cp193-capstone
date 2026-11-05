import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// The test seeds through the same payload builder as scripts/seed-content.mts.
// eslint-disable-next-line no-restricted-imports
import { loadContent } from "@/lib/services/content/load";
// eslint-disable-next-line no-restricted-imports
import { toSeedPayload } from "@/lib/services/content/payload";
// eslint-disable-next-line no-restricted-imports
import { explanation, item, testBundle } from "@/lib/services/content/test-bundle";
import { getPassages, getSurahContent, getSurahQuestions, getVerseTexts } from "./content";

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
  "explanation_item",
  "explanation_item_citation",
  "surah_brief_item",
  "surah_brief_item_citation",
  "word_meaning_elsewhere",
  "qa_question",
  "qa_question_citation",
  "qa_question_review",
];

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/**
 * The test bundle with its second reading section left as a draft that already has a point, a
 * passage only that draft and a draft question cite (passage-3), and a passage only a published
 * question cites (passage-4).
 */
function dbBundle() {
  const bundle = testBundle();
  const [first] = bundle.surahs;
  const section = first.explanations.findIndex((e) => e.id === "s1-reading-2");
  const draft = explanation("s1-reading-2", "reading_section", "1:3", "1:4", "draft");
  draft.parts.context = [item("draft point")];
  first.explanations[section] = draft;
  bundle.sources[0].passages.push({
    id: "passage-3",
    volume: null,
    page: "3",
    verse: null,
    textAr: null,
    summary: { en: null, ko: null },
    url: null,
  });
  bundle.sources[0].passages.push({
    id: "passage-4",
    volume: null,
    page: "4",
    verse: null,
    textAr: null,
    summary: { en: null, ko: null },
    url: null,
  });
  first.qa[0].citations = ["passage-1", "passage-4"];
  first.qa[2].citations = ["passage-3"];
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
    await seed(toSeedPayload(dbBundle()));
  });

  afterAll(async () => {
    // Put the real content back.
    if (service) {
      await seed(toSeedPayload(loadContent().bundle));
    }
  });

  it("gives the same database when seeded twice", async () => {
    const before = await snapshot();
    await seed(toSeedPayload(dbBundle()));
    expect(await snapshot()).toEqual(before);
  });

  it("deletes rows that left the content", async () => {
    const smaller = testBundle();
    smaller.surahs[0].explanations.pop();
    await seed(toSeedPayload(smaller));
    const { data } = await service.from("explanation").select("id").eq("id", "s1-draft");
    expect(data).toEqual([]);
    await seed(toSeedPayload(dbBundle()));
  });

  it("moves sections to new verse ranges on a re-seed, and deletes the old spans", async () => {
    // As when a placeholder section over a whole surah is split into its real sections (#22).
    const moved = dbBundle();
    const [first] = moved.surahs;
    first.explanations.find((e) => e.id === "s1-reading-1")!.span = { from: "1:1", to: "1:1" };
    first.explanations.find((e) => e.id === "s1-reading-2")!.span = { from: "1:2", to: "1:4" };
    await seed(toSeedPayload(moved));

    const sections = await service
      .from("reading_section")
      .select("position, explanation_id, span_id")
      .eq("surah", 1)
      .order("position");
    expect(sections.data).toEqual([
      { position: 1, explanation_id: "s1-reading-1", span_id: "1:1-1:1" },
      { position: 2, explanation_id: "s1-reading-2", span_id: "1:2-1:4" },
    ]);
    const explanation = await service
      .from("explanation")
      .select("span_id")
      .eq("id", "s1-reading-1");
    expect(explanation.data).toEqual([{ span_id: "1:1-1:1" }]);
    const oldSpans = await service.from("span").select("id").in("id", ["1:1-1:2", "1:3-1:4"]);
    expect(oldSpans.data).toEqual([]);

    // And back again.
    await seed(toSeedPayload(dbBundle()));
    const restored = await service.from("explanation").select("span_id").eq("id", "s1-reading-1");
    expect(restored.data).toEqual([{ span_id: "1:1-1:2" }]);
  });

  it("refuses a payload with a missing table, and changes nothing", async () => {
    const before = await snapshot();
    const broken = Object.fromEntries(
      Object.entries(toSeedPayload(dbBundle())).filter(([table]) => table !== "explanations"),
    );
    const { error } = await service.rpc("seed_content", { payload: broken });
    expect(error?.message).toContain("payload.explanations");
    expect(await snapshot()).toEqual(before);
  });

  it("still seeds a payload without fixed questions, as the seed on main sends", async () => {
    const withoutQa = Object.fromEntries(
      Object.entries(toSeedPayload(dbBundle())).filter(([table]) => !table.startsWith("qa_")),
    );
    await seed(withoutQa);
    expect((await service.from("qa_question").select("id")).data).toEqual([]);
    await seed(toSeedPayload(dbBundle()));
    expect((await service.from("qa_question").select("id")).data).toHaveLength(3);
  });

  describe("lib/data returns only published content", () => {
    it("getSurahContent", async () => {
      const content = await getSurahContent(1);
      expect(content?.surah.verseCount).toBe(4);
      expect(content?.verses).toHaveLength(4);
      expect(content?.verses[0].words.map((w) => w.position)).toEqual([1, 2, 3, 4]);
      expect(content?.brief).toEqual([
        {
          text: { en: "brief paragraph 1 (en)", ko: "brief paragraph 1 (ko)" },
          citations: [{ passageId: "passage-1", quoting: null }],
        },
        {
          text: { en: "brief paragraph 2 (en)", ko: "brief paragraph 2 (ko)" },
          citations: [{ passageId: "passage-2", quoting: null }],
        },
      ]);
      expect(content?.wordMeanings).toEqual([
        {
          word: { surah: 1, ayah: 1, word: 1 },
          meaning: { en: "meaning of 1:1:1 (en)", ko: "meaning of 1:1:1 (ko)" },
          citations: [{ passageId: "passage-1", quoting: null }],
          elsewhere: [
            {
              verse: { surah: 2, ayah: 3 },
              text: { en: "elsewhere in 2:3 (en)", ko: "elsewhere in 2:3 (ko)" },
            },
          ],
        },
      ]);
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

    it("getSurahContent gives each point its own citations, and related verses their verse", async () => {
      const parts = (await getSurahContent(1))?.readingSections[0].explanation?.parts;
      expect(parts?.context).toEqual([
        {
          text: { en: "context of s1-reading-1 (en)", ko: "context of s1-reading-1 (ko)" },
          citations: [
            { passageId: "passage-1", quoting: null },
            { passageId: "passage-2", quoting: "[narrator]" },
          ],
        },
      ]);
      expect(parts?.relatedVerses).toEqual([
        {
          verse: { surah: 3, ayah: 5 },
          text: { en: "why 3:5 (en)", ko: "why 3:5 (ko)" },
          citations: [{ passageId: "passage-1", quoting: null }],
        },
      ]);
      expect(parts?.wordMeanings).toEqual([]);
    });

    it("getVerseTexts returns only the referenced verses that are imported", async () => {
      const verses = await getVerseTexts([
        { surah: 3, ayah: 5 },
        { surah: 2, ayah: 3 },
        { surah: 1, ayah: 1 },
      ]);
      expect(verses.map((v) => [v.surah, v.ayah])).toEqual([
        [1, 1],
        [2, 3],
      ]);
      expect(verses[0].textAr).toContain("ابت");
      expect(await getVerseTexts([])).toEqual([]);
    });

    it("getPassages returns cited passages in the order asked, and skips uncited ones", async () => {
      const passages = await getPassages(["passage-3", "passage-2", "passage-1"]);
      expect(passages.map((p) => p.id)).toEqual(["passage-2", "passage-1"]);
      expect(await getPassages([])).toEqual([]);
    });

    it("getSurahQuestions returns the published questions in order, with their citations", async () => {
      const questions = await getSurahQuestions(1);
      expect(questions.map((q) => q.id)).toEqual(["s1-qa-1", "s1-qa-2"]);
      expect(questions[0]).toEqual({
        id: "s1-qa-1",
        span: {
          start: { surah: 1, ayah: 1, word: null },
          end: { surah: 1, ayah: 2, word: null },
        },
        question: { en: "question s1-qa-1 (en)", ko: "question s1-qa-1 (ko)" },
        answer: { en: "answer s1-qa-1 (en)", ko: "answer s1-qa-1 (ko)" },
        citations: [
          { passageId: "passage-1", quoting: null },
          { passageId: "passage-4", quoting: null },
        ],
      });
      expect(questions[1].citations).toEqual([
        { passageId: "passage-2", quoting: null },
        { passageId: "passage-1", quoting: "[narrator]" },
      ]);
      expect(await getSurahQuestions(2)).toEqual([]);
    });

    it("getPassages returns a passage that only a published question cites", async () => {
      expect((await getPassages(["passage-4"])).map((p) => p.id)).toEqual(["passage-4"]);
    });

    it("getPassages gives each passage its link, or null", async () => {
      const passages = await getPassages(["passage-1", "passage-2"]);
      expect(passages.map((p) => [p.id, p.url])).toEqual([
        ["passage-1", "https://example.com/book/1/10"],
        ["passage-2", null],
      ]);
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
      const passage = await db.from("passage").select("id").eq("id", "passage-3");
      expect(passage.data).toEqual([]);
      const draftItems = await db
        .from("explanation_item")
        .select("sort_order")
        .eq("explanation_id", "s1-reading-2");
      expect(draftItems.data).toEqual([]);
      const draftCitations = await db
        .from("explanation_item_citation")
        .select("sort_order")
        .eq("explanation_id", "s1-reading-2");
      expect(draftCitations.data).toEqual([]);
      const draftElsewhere = await db
        .from("word_meaning_elsewhere")
        .select("ayah")
        .eq("position", 2);
      expect(draftElsewhere.data).toEqual([]);
      const transliteration = await db.from("verse_transliteration").select("ayah").eq("ayah", 2);
      expect(transliteration.data).toEqual([]);
      const draftQuestion = await db.from("qa_question").select("id").eq("id", "s1-qa-draft");
      expect(draftQuestion.data).toEqual([]);
      const draftQuestionCitations = await db
        .from("qa_question_citation")
        .select("sort_order")
        .eq("question_id", "s1-qa-draft");
      expect(draftQuestionCitations.data).toEqual([]);
      for (const table of [
        "explanation_review",
        "word_meaning_review",
        "surah_brief_review",
        "verse_transliteration_review",
        "qa_question_review",
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
      expect((await db.from("qa_question").select("id")).data).toHaveLength(2);
      expect((await db.from("qa_question_citation").select("question_id")).data).toHaveLength(4);
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
        payload: toSeedPayload(dbBundle()),
      });
      expect(error).not.toBeNull();
    });
  });

  it("stores only https links for passages", async () => {
    const update = await service
      .from("passage")
      .update({ url: "http://example.com/book/1/10" })
      .eq("id", "passage-1");
    expect(update.error?.message).toMatch(/check constraint/);
    const { data } = await service.from("passage").select("url").eq("id", "passage-1");
    expect(data).toEqual([{ url: "https://example.com/book/1/10" }]);
  });

  it("has no tester preview left (dropped in 20261029120000)", async () => {
    expect((await anon.rpc("is_tester")).error).not.toBeNull();
    expect((await user.rpc("is_tester")).error).not.toBeNull();
    expect((await service.from("tester").select("user_id")).error).not.toBeNull();
  });
});
