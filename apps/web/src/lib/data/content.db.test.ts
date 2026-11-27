import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// The test seeds through the same plan and runner as scripts/seed-content.mts.
// eslint-disable-next-line no-restricted-imports
import { loadContent, type ContentBundle } from "@/lib/services/content/load";
// eslint-disable-next-line no-restricted-imports
import { toSeedPlan, type SeedPlan } from "@/lib/services/content/payload";
// eslint-disable-next-line no-restricted-imports
import { runSeed, type SeedCall, type SeedFunction } from "@/lib/services/content/seed-run";
// eslint-disable-next-line no-restricted-imports
import {
  explanation,
  item,
  testBundle,
  withPartialSurah,
} from "@/lib/services/content/test-bundle";
import {
  getPassages,
  getSurahContent,
  getSurahList,
  getSurahQuestions,
  getVerseTexts,
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

  const call: SeedCall = (fn, payload) => service.rpc(fn, { payload });

  async function run(plan: SeedPlan, through: SeedCall = call) {
    return runSeed(plan, through, () => {});
  }

  async function seed(bundle: ContentBundle, only?: number[]) {
    const result = await run(toSeedPlan(bundle, only));
    expect(result).toMatchObject({ ok: true });
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
    await seed(dbBundle());
  });

  afterAll(async () => {
    // Put the real content back.
    if (service) {
      await seed(loadContent().bundle);
    }
  });

  it("gives the same database when seeded twice", async () => {
    const before = await snapshot();
    await seed(dbBundle());
    expect(await snapshot()).toEqual(before);
  });

  it("deletes rows that left the content", async () => {
    const smaller = testBundle();
    smaller.surahs[0].explanations.pop();
    await seed(smaller);
    const { data } = await service.from("explanation").select("id").eq("id", "s1-draft");
    expect(data).toEqual([]);
    await seed(dbBundle());
  });

  it("moves sections to new verse ranges on a re-seed, and deletes the old spans", async () => {
    // As when a placeholder section over a whole surah is split into its real sections (#22).
    const moved = dbBundle();
    const [first] = moved.surahs;
    first.explanations.find((e) => e.id === "s1-reading-1")!.span = { from: "1:1", to: "1:1" };
    first.explanations.find((e) => e.id === "s1-reading-2")!.span = { from: "1:2", to: "1:4" };
    await seed(moved);

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
    // 1:3–4 is used by nothing now, so it is deleted. 1:1–2 stays: a fixed question (s1-qa-1)
    // is still about those verses.
    const oldSpans = await service.from("span").select("id").in("id", ["1:1-1:2", "1:3-1:4"]);
    expect(oldSpans.data).toEqual([{ id: "1:1-1:2" }]);

    // And back again.
    await seed(dbBundle());
    const restored = await service.from("explanation").select("span_id").eq("id", "s1-reading-1");
    expect(restored.data).toEqual([{ span_id: "1:1-1:2" }]);
  });

  it("refuses a payload with a missing part, and changes nothing", async () => {
    const before = await snapshot();
    const plan = toSeedPlan(dbBundle());
    const [first] = plan.surahs;
    const cases: [SeedFunction, object, string][] = [
      ["seed_surah_text", first.text, "words"],
      ["seed_shared_content", plan.shared, "passages"],
      ["seed_surah_content", first.content, "explanations"],
      ["seed_content_finish", plan.finish, "surahs"],
    ];
    for (const [fn, payload, missing] of cases) {
      const broken = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== missing));
      const { error } = await service.rpc(fn, { payload: broken });
      expect(error?.message, fn).toContain(`payload.${missing}`);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a surah's content holding a row of another surah, and changes nothing", async () => {
    const before = await snapshot();
    const { content } = toSeedPlan(dbBundle()).surahs[1];
    const meaning = { surah: 1, ayah: 1, position: 3, meaning_en: "x", meaning_ko: "x" };
    const { error } = await service.rpc("seed_surah_content", {
      payload: { ...content, word_meanings: [{ ...meaning, status: "draft" }] },
    });
    expect(error?.message).toContain("must belong to surah 2");
    expect(await snapshot()).toEqual(before);
  });

  it("seeds only the surahs asked for, and leaves the others as they are", async () => {
    const changed = dbBundle();
    changed.surahs[0].explanations = changed.surahs[0].explanations.filter(
      (e) => e.id !== "s1-draft",
    );
    changed.surahs[1].surah.names.en = "Renamed";
    const surahTwo = async () =>
      (await service.from("surah").select("name_en").eq("number", 2)).data;
    const before = await surahTwo();
    try {
      await seed(changed, [1]);
      const draft = await service.from("explanation").select("id").eq("id", "s1-draft");
      expect(draft.data).toEqual([]);
      expect(await surahTwo()).toEqual(before);
    } finally {
      await seed(dbBundle());
    }
  });

  it("keeps the surahs loaded before a failing one, and rolls the failing one back", async () => {
    // Surah 1 loses its draft; surah 2 gains an explanation whose point cites a passage that
    // doesn't exist, so its request fails after it has written the explanation.
    const bundle = dbBundle();
    bundle.surahs[0].explanations = bundle.surahs[0].explanations.filter(
      (e) => e.id !== "s1-draft",
    );
    const broken = explanation("s2-broken", "verse_explanation", "2:1", "2:2", "draft");
    broken.parts.context = [item("cites nothing real", ["no-such-passage"])];
    bundle.surahs[1].explanations = [broken];
    const sent: SeedFunction[] = [];
    try {
      const result = await run(toSeedPlan(bundle), (fn, payload) => {
        sent.push(fn);
        return call(fn, payload);
      });
      expect(result).toMatchObject({ ok: false, step: "content", surah: 2 });
      expect(sent.at(-1)).toBe("seed_surah_content");
      expect(sent).not.toContain("seed_content_finish");
      const left = await service
        .from("explanation")
        .select("id")
        .in("id", ["s1-draft", "s2-broken"]);
      expect(left.data).toEqual([]);
    } finally {
      await seed(dbBundle());
    }
  });

  describe("lib/data returns only published content", () => {
    it("getSurahContent", async () => {
      const content = await getSurahContent(1);
      expect(content?.surah.verseCount).toBe(4);
      expect(content?.verses).toHaveLength(4);
      expect(content?.verses[0].words.map((w) => w.position)).toEqual([1, 2, 3, 4]);
      // testPages: page 2 of the test metadata starts at 1:3.
      expect(content?.verses.map((v) => v.page)).toEqual([1, 1, 2, 2]);
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
      const plan = toSeedPlan(dbBundle());
      const [first] = plan.surahs;
      const calls: [string, object | undefined][] = [
        ["seed_content", { payload: {} }],
        ["seed_surah_text", { payload: first.text }],
        ["seed_shared_content", { payload: plan.shared }],
        ["seed_surah_content", { payload: first.content }],
        ["seed_content_finish", { payload: plan.finish }],
        ["seed_delete_unused_spans", undefined],
      ];
      for (const [fn, args] of calls) {
        const { error } = await client().rpc(fn, args);
        expect(error, fn).not.toBeNull();
      }
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

  it("lists every surah in the database, explained or not, with the verses each holds", async () => {
    const listed = async () =>
      (await getSurahList()).map(({ number, ayahs }) => ({ number, ayahs }));
    try {
      // Surah 2 has no reading sections; surah 4 holds verses 34, 35 and 40, with draft sections.
      const drafts = withPartialSurah();
      drafts.surahs[2].explanations = [
        explanation("s4-reading-1", "reading_section", "4:34", "4:35", "draft"),
        explanation("s4-reading-2", "reading_section", "4:40", "4:40", "draft"),
      ];
      await seed(drafts);
      expect(await listed()).toEqual([
        { number: 1, ayahs: [1, 2, 3, 4] },
        { number: 2, ayahs: [1, 2, 3] },
        { number: 4, ayahs: [34, 35, 40] },
      ]);
    } finally {
      await seed(dbBundle());
    }
  });

  it("loads the whole Quran: every surah, and every verse and word of the longest", async () => {
    // The real content: 114 surahs and 6,236 verses. PostgREST caps a response at 1,000 rows
    // (max_rows); that cap is on the top-level rows, so a surah's words come back whole.
    const { bundle } = loadContent();
    const plan = toSeedPlan(bundle);
    const timed = async () => {
      let slowest = { ms: 0, fn: "" };
      const started = performance.now();
      const result = await run(plan, async (fn, payload) => {
        const callStarted = performance.now();
        const answer = await call(fn, payload);
        const ms = Math.round(performance.now() - callStarted);
        if (ms > slowest.ms) {
          slowest = { ms, fn };
        }
        return answer;
      });
      expect(result).toMatchObject({ ok: true });
      const total = Math.round(performance.now() - started);
      return `${total} ms (slowest request ${slowest.ms} ms, ${slowest.fn})`;
    };
    try {
      const first = await timed();
      const again = await timed();
      console.log(`Seeding the whole Quran: ${first}, then ${again} with nothing changed`);
      const surahs = await getSurahList();
      expect(surahs).toHaveLength(114);
      expect(surahs.reduce((total, surah) => total + surah.ayahs.length, 0)).toBe(6236);

      const baqara = await getSurahContent(2);
      const words = bundle.surahs[1].words.verses.reduce((n, v) => n + v.words.length, 0);
      expect(baqara?.verses).toHaveLength(286);
      expect(baqara?.verses.reduce((n, v) => n + v.words.length, 0)).toBe(words);
      expect(baqara?.verses[0].page).toBe(2);
      expect(baqara?.verses[285].page).toBe(49);
    } finally {
      await seed(dbBundle());
    }
  }, 120_000);

  it("has no tester preview left (dropped in 20261029120000)", async () => {
    expect((await anon.rpc("is_tester")).error).not.toBeNull();
    expect((await user.rpc("is_tester")).error).not.toBeNull();
    expect((await service.from("tester").select("user_id")).error).not.toBeNull();
  });
});
