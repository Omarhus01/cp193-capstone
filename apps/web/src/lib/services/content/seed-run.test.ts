import { describe, expect, it } from "vitest";
import { toSeedPlan } from "./payload";
import { runSeed, type SeedCall, type SeedFunction } from "./seed-run";
import { withPartialSurah } from "./test-bundle";

/** A fake database: records each call, answers with counts, and fails the call `failAt`. */
function fakeDatabase(failAt?: number) {
  const calls: { fn: SeedFunction; surah: unknown }[] = [];
  const call: SeedCall = async (fn, payload) => {
    const p = payload as { surah?: number | { number: number } };
    const surah = typeof p.surah === "object" ? p.surah.number : (p.surah ?? null);
    calls.push({ fn, surah });
    if (calls.length === failAt) {
      return { data: null, error: { message: "canceling statement due to statement timeout" } };
    }
    return {
      data: fn === "seed_surah_text" ? { surah, verses: 4, words: 16 } : { rows: 1 },
      error: null,
    };
  };
  return { calls, call };
}

/** A clock that moves 250 ms each time it is read. */
function clock() {
  let ms = 0;
  return () => (ms += 250);
}

describe("runSeed", () => {
  const plan = toSeedPlan(withPartialSurah());

  it("sends the text of each surah, then the shared data, then each surah's content, then finish", async () => {
    const { calls, call } = fakeDatabase();
    const result = await runSeed(plan, call, () => {}, clock());
    expect(calls).toEqual([
      { fn: "seed_surah_text", surah: 1 },
      { fn: "seed_surah_text", surah: 2 },
      { fn: "seed_surah_text", surah: 4 },
      { fn: "seed_shared_content", surah: null },
      { fn: "seed_surah_content", surah: 1 },
      { fn: "seed_surah_content", surah: 2 },
      { fn: "seed_surah_content", surah: 4 },
      { fn: "seed_content_finish", surah: null },
    ]);
    expect(result).toMatchObject({ ok: true, counts: { rows: 1 } });
  });

  it("stops at the first failure, says where, and sends nothing after it", async () => {
    const { calls, call } = fakeDatabase(6);
    const log: string[] = [];
    const result = await runSeed(plan, call, (line) => log.push(line), clock());
    expect(result).toMatchObject({
      ok: false,
      step: "content",
      surah: 2,
      message: "canceling statement due to statement timeout",
    });
    expect(calls).toHaveLength(6);
    expect(log.at(-1)).toBe("[6/8] content, surah 2: failed (0.3 s)");
  });

  it("names a failed shared step without a surah", async () => {
    const { call } = fakeDatabase(4);
    const result = await runSeed(plan, call, () => {}, clock());
    expect(result).toMatchObject({ ok: false, step: "sources and passages", surah: null });
  });

  it("prints one line per surah and step, with its time, then the total time", async () => {
    const { call } = fakeDatabase();
    const log: string[] = [];
    await runSeed(plan, call, (line) => log.push(line), clock());
    expect(log).toEqual([
      "[1/8] Quran text, surah 1: 4 verses, 16 words (0.3 s)",
      "[2/8] Quran text, surah 2: 4 verses, 16 words (0.3 s)",
      "[3/8] Quran text, surah 4: 4 verses, 16 words (0.3 s)",
      "[4/8] sources and passages: 1 rows (0.3 s)",
      "[5/8] content, surah 1: 1 rows (0.3 s)",
      "[6/8] content, surah 2: 1 rows (0.3 s)",
      "[7/8] content, surah 4: 1 rows (0.3 s)",
      "[8/8] finish (0.3 s)",
      // The clock is read twice per step and once at each end of the run: 17 × 250 ms.
      "Total time: 4.3 s",
    ]);
  });
});
