// The surah numbers given to the seed script: `npm run content:seed -- 2 4` seeds surahs 2 and 4
// (plus the shared sources and passages); no numbers seeds everything.

export type SurahArguments = { ok: true; surahs: number[] | null } | { ok: false; error: string };

/** `available` lists the surahs in content/. Returns them sorted, each once, or an error. */
export function parseSurahArguments(
  args: readonly string[],
  available: readonly number[],
): SurahArguments {
  if (args.length === 0) {
    return { ok: true, surahs: null };
  }
  const surahs = new Set<number>();
  for (const arg of args) {
    if (!/^\d+$/.test(arg) || Number(arg) < 1 || Number(arg) > 114) {
      return { ok: false, error: `"${arg}" isn't a surah number (1 to 114)` };
    }
    const number = Number(arg);
    if (!available.includes(number)) {
      return { ok: false, error: `surah ${number} isn't in content/surahs/` };
    }
    surahs.add(number);
  }
  return { ok: true, surahs: [...surahs].sort((a, b) => a - b) };
}
