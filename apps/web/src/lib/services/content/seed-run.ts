import type { SeedPlan } from "./payload";

// Runs a seed plan (payload.ts) one request at a time, in the order the database needs: the Quran
// text of each surah, then the shared sources and passages, then each surah's content, then the
// finish step. Each request is one transaction in the database. On the first failure it stops:
// what was sent before stays loaded, and nothing after it is sent.
//
// The request itself is passed in (`call`), so this file never talks to Supabase: the seed script
// and the local tests pass their own client.

export type SeedFunction =
  "seed_surah_text" | "seed_shared_content" | "seed_surah_content" | "seed_content_finish";

export type SeedCall = (
  fn: SeedFunction,
  payload: unknown,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type SeedStep = "Quran text" | "sources and passages" | "content" | "finish";

export type SeedResult =
  | { ok: true; counts: unknown; seconds: number }
  | { ok: false; step: SeedStep; surah: number | null; message: string; seconds: number };

type Request = { step: SeedStep; surah: number | null; fn: SeedFunction; payload: unknown };

function requests(plan: SeedPlan): Request[] {
  return [
    ...plan.surahs.map(({ number, text }) => ({
      step: "Quran text" as const,
      surah: number,
      fn: "seed_surah_text" as const,
      payload: text,
    })),
    { step: "sources and passages", surah: null, fn: "seed_shared_content", payload: plan.shared },
    ...plan.surahs.map(({ number, content }) => ({
      step: "content" as const,
      surah: number,
      fn: "seed_surah_content" as const,
      payload: content,
    })),
    { step: "finish", surah: null, fn: "seed_content_finish", payload: plan.finish },
  ];
}

/** "286 verses, 6116 words" from the counts a seed function returns, in name order. */
function describe(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "";
  }
  return Object.entries(data)
    .filter(([key, value]) => key !== "surah" && typeof value === "number")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${value} ${key.replaceAll("_", " ")}`)
    .join(", ");
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export async function runSeed(
  plan: SeedPlan,
  call: SeedCall,
  log: (line: string) => void = console.log,
  now: () => number = () => performance.now(),
): Promise<SeedResult> {
  const list = requests(plan);
  const width = String(list.length).length;
  const started = now();
  let counts: unknown = null;

  for (const [i, { step, surah, fn, payload }] of list.entries()) {
    const stepStarted = now();
    const { data, error } = await call(fn, payload);
    const label = surah === null ? step : `${step}, surah ${surah}`;
    const done = `[${String(i + 1).padStart(width)}/${list.length}] ${label}`;
    if (error) {
      log(`${done}: failed (${seconds(now() - stepStarted)})`);
      return {
        ok: false,
        step,
        surah,
        message: error.message,
        seconds: (now() - started) / 1000,
      };
    }
    const summary = step === "finish" ? "" : describe(data);
    log(`${done}${summary ? `: ${summary}` : ""} (${seconds(now() - stepStarted)})`);
    counts = data;
  }

  const total = now() - started;
  log(`Total time: ${seconds(total)}`);
  return { ok: true, counts, seconds: total / 1000 };
}
